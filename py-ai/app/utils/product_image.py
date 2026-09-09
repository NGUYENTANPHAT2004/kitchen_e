from typing import Any, Dict, Optional


def product_image_url(product: Dict[str, Any]) -> Optional[str]:
    """Return a JSON-safe URL from Mongoose image subdocuments or legacy strings."""
    images = product.get("images") or []
    image = next(
        (item for item in images if isinstance(item, dict) and item.get("isDefault")),
        images[0] if images else None,
    )
    value = image.get("url") if isinstance(image, dict) else image
    return value if isinstance(value, str) else None
