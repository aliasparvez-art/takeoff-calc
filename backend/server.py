from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Response, Query, Header
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

from auth import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user
from storage import init_storage, put_object, get_object, APP_NAME
from models import (
    UserCreate, UserLogin, UserResponse,
    ProjectCreate, ProjectResponse,
    BOQRowCreate, BOQRowResponse,
    DrawingCreate, DrawingResponse,
    RateAnalysisCreate, RateAnalysisResponse
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Auth endpoints
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_input: UserCreate, response: Response):
    email = user_input.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user_input.password)
    user_doc = {
        "_id": ObjectId(),
        "email": email,
        "password_hash": hashed,
        "name": user_input.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    user_id = str(user_doc["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        email=email,
        name=user_input.name,
        role="user",
        created_at=user_doc["created_at"].isoformat()
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(user_input: UserLogin, request: Request, response: Response):
    email = user_input.email.lower()
    # Use X-Forwarded-For header (set by proxy) or fall back to client host
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
    # Identifier prioritizes email so lockout works even when proxy IPs vary
    identifier = f"email:{email}"
    
    # Check brute force lockout
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("locked_until"):
        if datetime.fromisoformat(attempt["locked_until"]) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(user_input.password, user["password_hash"]):
        # Increment failed attempts
        if attempt:
            count = attempt.get("count", 0) + 1
            update_doc = {"count": count}
            if count >= 5:
                update_doc["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
            await db.login_attempts.update_one({"identifier": identifier}, {"$set": update_doc})
        else:
            await db.login_attempts.insert_one({
                "identifier": identifier,
                "count": 1,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Clear failed attempts
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        email=email,
        name=user.get("name", ""),
        role=user.get("role", "user"),
        created_at=user["created_at"].isoformat()
    )

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        import jwt as _jwt
        from auth import get_jwt_secret, JWT_ALGORITHM
        payload = _jwt.decode(refresh_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload["sub"]
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=new_access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except _jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except _jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request, db)
    created_at = user.get("created_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    elif not created_at:
        created_at = datetime.now(timezone.utc).isoformat()
    return UserResponse(
        id=user["_id"],
        email=user["email"],
        name=user.get("name", ""),
        role=user.get("role", "user"),
        created_at=created_at
    )

# Project endpoints
@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project_input: ProjectCreate, request: Request):
    user = await get_current_user(request, db)
    
    project_doc = {
        "_id": ObjectId(),
        "name": project_input.name,
        "project_number": project_input.project_number,
        "client": project_input.client,
        "prepared_by": project_input.prepared_by,
        "checked_by": project_input.checked_by,
        "revision_no": project_input.revision_no,
        "status": project_input.status,
        "owner_id": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.projects.insert_one(project_doc)
    
    return ProjectResponse(
        id=str(project_doc["_id"]),
        name=project_doc["name"],
        project_number=project_doc["project_number"],
        client=project_doc["client"],
        prepared_by=project_doc["prepared_by"],
        checked_by=project_doc["checked_by"],
        revision_no=project_doc["revision_no"],
        status=project_doc["status"],
        owner_id=user["_id"],
        created_at=project_doc["created_at"].isoformat(),
        updated_at=project_doc["updated_at"].isoformat()
    )

@api_router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(request: Request):
    user = await get_current_user(request, db)
    projects = await db.projects.find({"owner_id": user["_id"]}, {"_id": 1, "name": 1, "project_number": 1, "client": 1, "prepared_by": 1, "checked_by": 1, "revision_no": 1, "status": 1, "owner_id": 1, "created_at": 1, "updated_at": 1}).to_list(1000)
    
    return [
        ProjectResponse(
            id=str(p["_id"]),
            name=p["name"],
            project_number=p.get("project_number", ""),
            client=p.get("client", ""),
            prepared_by=p.get("prepared_by", ""),
            checked_by=p.get("checked_by", ""),
            revision_no=p.get("revision_no", "1"),
            status=p.get("status", "Draft"),
            owner_id=str(p["owner_id"]),
            created_at=p["created_at"].isoformat(),
            updated_at=p["updated_at"].isoformat()
        )
        for p in projects
    ]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectResponse(
        id=str(project["_id"]),
        name=project["name"],
        project_number=project.get("project_number", ""),
        client=project.get("client", ""),
        prepared_by=project.get("prepared_by", ""),
        checked_by=project.get("checked_by", ""),
        revision_no=project.get("revision_no", "1"),
        status=project.get("status", "Draft"),
        owner_id=str(project["owner_id"]),
        created_at=project["created_at"].isoformat(),
        updated_at=project["updated_at"].isoformat()
    )

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project_input: ProjectCreate, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {
            "name": project_input.name,
            "project_number": project_input.project_number,
            "client": project_input.client,
            "prepared_by": project_input.prepared_by,
            "checked_by": project_input.checked_by,
            "revision_no": project_input.revision_no,
            "status": project_input.status,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    updated = await db.projects.find_one({"_id": ObjectId(project_id)})
    return ProjectResponse(
        id=str(updated["_id"]),
        name=updated["name"],
        project_number=updated.get("project_number", ""),
        client=updated.get("client", ""),
        prepared_by=updated.get("prepared_by", ""),
        checked_by=updated.get("checked_by", ""),
        revision_no=updated.get("revision_no", "1"),
        status=updated.get("status", "Draft"),
        owner_id=str(updated["owner_id"]),
        created_at=updated["created_at"].isoformat(),
        updated_at=updated["updated_at"].isoformat()
    )

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    user = await get_current_user(request, db)
    result = await db.projects.delete_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete associated BOQ rows and drawings
    await db.boq_rows.delete_many({"project_id": project_id})
    await db.drawings.delete_many({"project_id": project_id})
    await db.rate_analysis.delete_many({"project_id": project_id})
    
    return {"message": "Project deleted successfully"}

# BOQ Row endpoints
@api_router.post("/projects/{project_id}/boq-rows", response_model=BOQRowResponse)
async def create_boq_row(project_id: str, row_input: BOQRowCreate, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Calculate quantity
    quantity = row_input.nos * row_input.length * row_input.breadth * row_input.depth if row_input.depth > 0 else \
               row_input.nos * row_input.length * row_input.breadth if row_input.breadth > 0 else \
               row_input.nos * row_input.length if row_input.length > 0 else row_input.nos
    
    # Get next order number
    last_row = await db.boq_rows.find_one({"project_id": project_id}, sort=[("order", -1)])
    order = (last_row["order"] + 1) if last_row else 0
    
    row_doc = {
        "_id": ObjectId(),
        "project_id": project_id,
        "item_no": row_input.item_no,
        "description": row_input.description,
        "location": row_input.location,
        "drawing_ref": row_input.drawing_ref,
        "spec_ref": row_input.spec_ref,
        "remarks": row_input.remarks,
        "nos": row_input.nos,
        "length": row_input.length,
        "breadth": row_input.breadth,
        "depth": row_input.depth,
        "unit": row_input.unit,
        "quantity": quantity,
        "is_deduction": row_input.is_deduction,
        "order": order,
        "created_at": datetime.now(timezone.utc)
    }
    await db.boq_rows.insert_one(row_doc)
    
    return BOQRowResponse(
        id=str(row_doc["_id"]),
        project_id=project_id,
        item_no=row_doc["item_no"],
        description=row_doc["description"],
        location=row_doc["location"],
        drawing_ref=row_doc["drawing_ref"],
        spec_ref=row_doc["spec_ref"],
        remarks=row_doc["remarks"],
        nos=row_doc["nos"],
        length=row_doc["length"],
        breadth=row_doc["breadth"],
        depth=row_doc["depth"],
        unit=row_doc["unit"],
        quantity=row_doc["quantity"],
        is_deduction=row_doc["is_deduction"],
        order=row_doc["order"],
        created_at=row_doc["created_at"].isoformat()
    )

@api_router.get("/projects/{project_id}/boq-rows", response_model=list[BOQRowResponse])
async def list_boq_rows(project_id: str, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    rows = await db.boq_rows.find({"project_id": project_id}, {"_id": 1, "project_id": 1, "item_no": 1, "description": 1, "location": 1, "drawing_ref": 1, "spec_ref": 1, "remarks": 1, "nos": 1, "length": 1, "breadth": 1, "depth": 1, "unit": 1, "quantity": 1, "is_deduction": 1, "order": 1, "created_at": 1}).sort("order", 1).to_list(10000)
    
    return [
        BOQRowResponse(
            id=str(r["_id"]),
            project_id=r["project_id"],
            item_no=r["item_no"],
            description=r["description"],
            location=r.get("location", ""),
            drawing_ref=r.get("drawing_ref", ""),
            spec_ref=r.get("spec_ref", ""),
            remarks=r.get("remarks", ""),
            nos=r.get("nos", 1.0),
            length=r.get("length", 0.0),
            breadth=r.get("breadth", 0.0),
            depth=r.get("depth", 0.0),
            unit=r.get("unit", "m"),
            quantity=r.get("quantity", 0.0),
            is_deduction=r.get("is_deduction", False),
            order=r.get("order", 0),
            created_at=r["created_at"].isoformat()
        )
        for r in rows
    ]

@api_router.put("/projects/{project_id}/boq-rows/{row_id}", response_model=BOQRowResponse)
async def update_boq_row(project_id: str, row_id: str, row_input: BOQRowCreate, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Calculate quantity
    quantity = row_input.nos * row_input.length * row_input.breadth * row_input.depth if row_input.depth > 0 else \
               row_input.nos * row_input.length * row_input.breadth if row_input.breadth > 0 else \
               row_input.nos * row_input.length if row_input.length > 0 else row_input.nos
    
    await db.boq_rows.update_one(
        {"_id": ObjectId(row_id), "project_id": project_id},
        {"$set": {
            "item_no": row_input.item_no,
            "description": row_input.description,
            "location": row_input.location,
            "drawing_ref": row_input.drawing_ref,
            "spec_ref": row_input.spec_ref,
            "remarks": row_input.remarks,
            "nos": row_input.nos,
            "length": row_input.length,
            "breadth": row_input.breadth,
            "depth": row_input.depth,
            "unit": row_input.unit,
            "quantity": quantity,
            "is_deduction": row_input.is_deduction
        }}
    )
    
    updated = await db.boq_rows.find_one({"_id": ObjectId(row_id)})
    return BOQRowResponse(
        id=str(updated["_id"]),
        project_id=updated["project_id"],
        item_no=updated["item_no"],
        description=updated["description"],
        location=updated.get("location", ""),
        drawing_ref=updated.get("drawing_ref", ""),
        spec_ref=updated.get("spec_ref", ""),
        remarks=updated.get("remarks", ""),
        nos=updated.get("nos", 1.0),
        length=updated.get("length", 0.0),
        breadth=updated.get("breadth", 0.0),
        depth=updated.get("depth", 0.0),
        unit=updated.get("unit", "m"),
        quantity=updated.get("quantity", 0.0),
        is_deduction=updated.get("is_deduction", False),
        order=updated.get("order", 0),
        created_at=updated["created_at"].isoformat()
    )

@api_router.delete("/projects/{project_id}/boq-rows/{row_id}")
async def delete_boq_row(project_id: str, row_id: str, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = await db.boq_rows.delete_one({"_id": ObjectId(row_id), "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="BOQ row not found")
    
    return {"message": "BOQ row deleted successfully"}

# Drawing upload endpoints
@api_router.post("/projects/{project_id}/drawings")
async def upload_drawing(project_id: str, file: UploadFile = File(...), request: Request = None):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/drawings/{user['_id']}/{project_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    
    drawing_doc = {
        "_id": ObjectId(),
        "project_id": project_id,
        "filename": file.filename,
        "storage_path": result["path"],
        "content_type": file.content_type,
        "size": result["size"],
        "scale_factor": 1.0,
        "scale_ratio": "1:1",
        "page_count": 1,
        "uploaded_by": user["_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.drawings.insert_one(drawing_doc)
    
    return DrawingResponse(
        id=str(drawing_doc["_id"]),
        project_id=project_id,
        filename=drawing_doc["filename"],
        storage_path=drawing_doc["storage_path"],
        scale_factor=drawing_doc["scale_factor"],
        scale_ratio=drawing_doc["scale_ratio"],
        page_count=drawing_doc["page_count"],
        uploaded_by=user["_id"],
        created_at=drawing_doc["created_at"].isoformat()
    )

@api_router.get("/projects/{project_id}/drawings", response_model=list[DrawingResponse])
async def list_drawings(project_id: str, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    drawings = await db.drawings.find(
        {"project_id": project_id, "is_deleted": False},
        {"_id": 1, "project_id": 1, "filename": 1, "storage_path": 1, "scale_factor": 1, "scale_ratio": 1, "page_count": 1, "uploaded_by": 1, "created_at": 1}
    ).to_list(1000)
    
    return [
        DrawingResponse(
            id=str(d["_id"]),
            project_id=d["project_id"],
            filename=d["filename"],
            storage_path=d["storage_path"],
            scale_factor=d.get("scale_factor", 1.0),
            scale_ratio=d.get("scale_ratio", "1:1"),
            page_count=d.get("page_count", 1),
            uploaded_by=str(d["uploaded_by"]),
            created_at=d["created_at"].isoformat()
        )
        for d in drawings
    ]

@api_router.get("/drawings/{drawing_id}/download")
async def download_drawing(drawing_id: str, request: Request, authorization: str = Header(None), auth: str = Query(None)):
    # Support both header and query param auth
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    
    if token:
        request.cookies["access_token"] = token
    
    user = await get_current_user(request, db)
    drawing = await db.drawings.find_one({"_id": ObjectId(drawing_id), "is_deleted": False})
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")
    
    data, content_type = get_object(drawing["storage_path"])
    return Response(content=data, media_type=drawing.get("content_type", content_type))

@api_router.put("/drawings/{drawing_id}/scale")
async def update_drawing_scale(drawing_id: str, scale_data: dict, request: Request):
    user = await get_current_user(request, db)
    drawing = await db.drawings.find_one({"_id": ObjectId(drawing_id), "is_deleted": False})
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")
    
    await db.drawings.update_one(
        {"_id": ObjectId(drawing_id)},
        {"$set": {
            "scale_factor": scale_data.get("scale_factor", 1.0),
            "scale_ratio": scale_data.get("scale_ratio", "1:1")
        }}
    )
    
    return {"message": "Scale updated successfully"}

# Rate Analysis endpoints
@api_router.post("/projects/{project_id}/rate-analysis", response_model=RateAnalysisResponse)
async def create_rate_analysis(project_id: str, rate_input: RateAnalysisCreate, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Calculate total rate
    material_total = sum(rate_input.material_rates.values())
    labor_total = sum(rate_input.labor_rates.values())
    equipment_total = sum(rate_input.equipment_rates.values())
    subtotal = material_total + labor_total + equipment_total
    overhead = subtotal * (rate_input.overhead_percentage / 100)
    profit = (subtotal + overhead) * (rate_input.profit_percentage / 100)
    total_rate = subtotal + overhead + profit
    
    # Get BOQ row for unit
    boq_row = await db.boq_rows.find_one({"_id": ObjectId(rate_input.boq_item_id)})
    unit = boq_row["unit"] if boq_row else "m"
    
    rate_doc = {
        "_id": ObjectId(),
        "project_id": project_id,
        "boq_item_id": rate_input.boq_item_id,
        "material_rates": rate_input.material_rates,
        "labor_rates": rate_input.labor_rates,
        "equipment_rates": rate_input.equipment_rates,
        "overhead_percentage": rate_input.overhead_percentage,
        "profit_percentage": rate_input.profit_percentage,
        "total_rate": total_rate,
        "unit": unit,
        "created_at": datetime.now(timezone.utc)
    }
    await db.rate_analysis.insert_one(rate_doc)
    
    return RateAnalysisResponse(
        id=str(rate_doc["_id"]),
        project_id=project_id,
        boq_item_id=rate_input.boq_item_id,
        material_rates=rate_input.material_rates,
        labor_rates=rate_input.labor_rates,
        equipment_rates=rate_input.equipment_rates,
        overhead_percentage=rate_input.overhead_percentage,
        profit_percentage=rate_input.profit_percentage,
        total_rate=total_rate,
        unit=unit,
        created_at=rate_doc["created_at"].isoformat()
    )

@api_router.get("/projects/{project_id}/rate-analysis", response_model=list[RateAnalysisResponse])
async def list_rate_analysis(project_id: str, request: Request):
    user = await get_current_user(request, db)
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    rates = await db.rate_analysis.find({"project_id": project_id}).to_list(1000)
    
    return [
        RateAnalysisResponse(
            id=str(r["_id"]),
            project_id=r["project_id"],
            boq_item_id=r["boq_item_id"],
            material_rates=r.get("material_rates", {}),
            labor_rates=r.get("labor_rates", {}),
            equipment_rates=r.get("equipment_rates", {}),
            overhead_percentage=r.get("overhead_percentage", 10.0),
            profit_percentage=r.get("profit_percentage", 10.0),
            total_rate=r.get("total_rate", 0.0),
            unit=r.get("unit", "m"),
            created_at=r["created_at"].isoformat()
        )
        for r in rates
    ]

# Seed admin user
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@qto.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        admin_doc = {
            "_id": ObjectId(),
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(admin_doc)
        logger.info(f"Admin user created: {admin_email}")
        await seed_sample_project(str(admin_doc["_id"]))
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated: {admin_email}")
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin Account\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/register\n")
        f.write("- POST /api/auth/login\n")
        f.write("- GET /api/auth/me\n")
        f.write("- POST /api/auth/logout\n")


async def seed_sample_project(owner_id: str):
    """Seed a sample project with BOQ rows for the admin user."""
    project_doc = {
        "_id": ObjectId(),
        "name": "Sample Project - Office Building",
        "project_number": "PRJ-2026-001",
        "client": "ACME Construction Ltd",
        "prepared_by": "Senior Estimator",
        "checked_by": "Project Manager",
        "revision_no": "1",
        "status": "Draft",
        "owner_id": owner_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.projects.insert_one(project_doc)
    project_id = str(project_doc["_id"])
    
    sample_rows = [
        {"item_no": "1.1.1", "description": "Excavation in ordinary soil for foundation", "location": "Block A - Foundation", "drawing_ref": "DWG-A-101", "spec_ref": "NBS D20.10", "remarks": "Up to 1.5m depth", "nos": 1, "length": 24.0, "breadth": 18.0, "depth": 1.5, "unit": "m³"},
        {"item_no": "1.2.1", "description": "PCC 1:3:6 in foundation", "location": "Block A - Foundation", "drawing_ref": "DWG-S-201", "spec_ref": "NBS E10.20", "remarks": "75mm thick", "nos": 1, "length": 24.0, "breadth": 18.0, "depth": 0.075, "unit": "m³"},
        {"item_no": "2.1.1", "description": "RCC M25 in column footings", "location": "Block A - Foundation", "drawing_ref": "DWG-S-201", "spec_ref": "NBS E20.10", "remarks": "Include reinforcement", "nos": 12, "length": 2.0, "breadth": 2.0, "depth": 0.6, "unit": "m³"},
        {"item_no": "2.2.1", "description": "Brick masonry walls 230mm thick", "location": "Block A - GF", "drawing_ref": "DWG-A-201", "spec_ref": "NBS F10.30", "remarks": "External walls", "nos": 1, "length": 84.0, "breadth": 0.23, "depth": 3.5, "unit": "m³"},
        {"item_no": "2.2.2", "description": "Deduct - Door openings", "location": "Block A - GF", "drawing_ref": "DWG-A-201", "spec_ref": "NBS F10.30", "remarks": "8 doors 1.0x2.1", "nos": 8, "length": 1.0, "breadth": 0.23, "depth": 2.1, "unit": "m³", "is_deduction": True},
        {"item_no": "3.1.1", "description": "Plastering 12mm thick to walls", "location": "Block A - GF", "drawing_ref": "DWG-A-301", "spec_ref": "NBS M20.10", "remarks": "Internal walls", "nos": 1, "length": 168.0, "breadth": 3.5, "depth": 1, "unit": "m²"},
        {"item_no": "4.1.1", "description": "Vitrified tile flooring 600x600mm", "location": "Block A - GF", "drawing_ref": "DWG-A-401", "spec_ref": "NBS M40.10", "remarks": "Premium grade", "nos": 1, "length": 24.0, "breadth": 18.0, "depth": 1, "unit": "m²"},
    ]
    
    for i, row_data in enumerate(sample_rows):
        is_deduction = row_data.pop("is_deduction", False)
        nos = row_data.get("nos", 1)
        length = row_data.get("length", 0)
        breadth = row_data.get("breadth", 0)
        depth = row_data.get("depth", 0)
        
        quantity = nos * length * breadth * depth if depth > 0 else \
                   nos * length * breadth if breadth > 0 else \
                   nos * length if length > 0 else nos
        
        row_doc = {
            "_id": ObjectId(),
            "project_id": project_id,
            "item_no": row_data["item_no"],
            "description": row_data["description"],
            "location": row_data["location"],
            "drawing_ref": row_data["drawing_ref"],
            "spec_ref": row_data["spec_ref"],
            "remarks": row_data["remarks"],
            "nos": nos,
            "length": length,
            "breadth": breadth,
            "depth": depth,
            "unit": row_data["unit"],
            "quantity": quantity,
            "is_deduction": is_deduction,
            "order": i,
            "created_at": datetime.now(timezone.utc)
        }
        await db.boq_rows.insert_one(row_doc)
    
    logger.info(f"Sample project seeded: {project_id}")

@app.on_event("startup")
async def startup():
    try:
        # Initialize storage
        init_storage()
        logger.info("Storage initialized")
        
        # Create indexes
        await db.users.create_index("email", unique=True)
        await db.login_attempts.create_index("identifier")
        logger.info("Database indexes created")
        
        # Seed admin
        await seed_admin()
        
    except Exception as e:
        logger.error(f"Startup error: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3000')],
    allow_methods=["*"],
    allow_headers=["*"],
)
