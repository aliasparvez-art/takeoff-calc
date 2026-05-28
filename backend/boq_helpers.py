"""BOQ helper utilities — calculation and document serialization."""
from datetime import datetime, timezone
from models import BOQRowResponse


def calculate_quantity(nos: float, length: float, breadth: float, depth: float) -> float:
    """Compute BOQ quantity strictly as NOS × L × B × D/H.

    Per Enhancement 4 spec:
    - Any blank/zero dimension is treated as 1 in multiplication.
    - EXCEPT if all four are blank/zero, return 0 — frontend renders this as "—".
    """
    if not (nos or length or breadth or depth):
        return 0.0
    n = nos if nos else 1
    length_v = length if length else 1
    breadth_v = breadth if breadth else 1
    depth_v = depth if depth else 1
    return float(n * length_v * breadth_v * depth_v)


def serialize_boq_row(row_doc: dict) -> BOQRowResponse:
    """Convert a Mongo BOQ row document into the API response model."""
    return BOQRowResponse(
        id=str(row_doc["_id"]),
        project_id=row_doc["project_id"],
        item_no=row_doc["item_no"],
        description=row_doc["description"],
        location=row_doc.get("location", ""),
        drawing_ref=row_doc.get("drawing_ref", ""),
        spec_ref=row_doc.get("spec_ref", ""),
        remarks=row_doc.get("remarks", ""),
        nos=row_doc.get("nos", 1.0),
        length=row_doc.get("length", 0.0),
        breadth=row_doc.get("breadth", 0.0),
        depth=row_doc.get("depth", 0.0),
        unit=row_doc.get("unit", "m"),
        quantity=row_doc.get("quantity", 0.0),
        is_deduction=row_doc.get("is_deduction", False),
        order=row_doc.get("order", 0),
        created_at=row_doc["created_at"].isoformat()
            if isinstance(row_doc.get("created_at"), datetime)
            else row_doc.get("created_at", datetime.now(timezone.utc).isoformat()),
        measurement_meta=row_doc.get("measurement_meta", {}) or {},
    )


def build_boq_row_doc(project_id: str, row_input, order: int, _ObjectId) -> dict:
    """Build a Mongo BOQ row document from a BOQRowCreate input."""
    quantity = calculate_quantity(
        row_input.nos, row_input.length, row_input.breadth, row_input.depth
    )
    return {
        "_id": _ObjectId(),
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
        "created_at": datetime.now(timezone.utc),
        "measurement_meta": getattr(row_input, "measurement_meta", {}) or {},
    }
