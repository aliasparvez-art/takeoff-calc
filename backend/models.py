from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str = "user"
    created_at: str

class ProjectCreate(BaseModel):
    name: str
    project_number: Optional[str] = ""
    client: Optional[str] = ""
    prepared_by: Optional[str] = ""
    checked_by: Optional[str] = ""
    revision_no: Optional[str] = "1"
    status: Optional[str] = "Draft"

class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    project_number: str
    client: str
    prepared_by: str
    checked_by: str
    revision_no: str
    status: str
    owner_id: str
    created_at: str
    updated_at: str

class BOQRowCreate(BaseModel):
    item_no: str
    description: str
    location: Optional[str] = ""
    drawing_ref: Optional[str] = ""
    spec_ref: Optional[str] = ""
    remarks: Optional[str] = ""
    nos: Optional[float] = 1.0
    length: Optional[float] = 0.0
    breadth: Optional[float] = 0.0
    depth: Optional[float] = 0.0
    unit: Optional[str] = "m"
    is_deduction: Optional[bool] = False

class BOQRowResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    item_no: str
    description: str
    location: str
    drawing_ref: str
    spec_ref: str
    remarks: str
    nos: float
    length: float
    breadth: float
    depth: float
    unit: str
    quantity: float
    is_deduction: bool
    order: int
    created_at: str

class DrawingCreate(BaseModel):
    filename: str
    scale_factor: Optional[float] = 1.0
    scale_ratio: Optional[str] = "1:1"
    page_count: Optional[int] = 1

class DrawingResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    filename: str
    storage_path: str
    scale_factor: float
    scale_ratio: str
    page_count: int
    uploaded_by: str
    created_at: str

class RateAnalysisCreate(BaseModel):
    boq_item_id: str
    material_rates: Optional[dict] = {}
    labor_rates: Optional[dict] = {}
    equipment_rates: Optional[dict] = {}
    overhead_percentage: Optional[float] = 10.0
    profit_percentage: Optional[float] = 10.0

class RateAnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    boq_item_id: str
    material_rates: dict
    labor_rates: dict
    equipment_rates: dict
    overhead_percentage: float
    profit_percentage: float
    total_rate: float
    unit: str
    created_at: str


class MarkCreate(BaseModel):
    drawing_id: str
    page: Optional[int] = 1
    position_x: float
    position_y: float
    boq_row_id: Optional[str] = ""
    label: Optional[str] = ""


class MarkResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    drawing_id: str
    page: int
    ref_id: str
    position_x: float
    position_y: float
    boq_row_id: str
    label: str
    created_at: str