import os
from functools import lru_cache

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from rembg import new_session, remove

APP_NAME = "createtree-rembg-service"
DEFAULT_MODEL = os.getenv("REMBG_DEFAULT_MODEL", "birefnet-general")
MAX_UPLOAD_BYTES = int(os.getenv("REMBG_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

app = FastAPI(title=APP_NAME)


@lru_cache(maxsize=4)
def get_session(model: str):
    return new_session(model)


def validate_model(model: str) -> str:
    allowed = {
        "u2net",
        "u2netp",
        "u2net_human_seg",
        "silueta",
        "isnet-general-use",
        "birefnet-general",
        "birefnet-general-lite",
        "birefnet-portrait",
    }

    if model not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported rembg model: {model}")
    return model


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": APP_NAME,
        "defaultModel": DEFAULT_MODEL,
        "modelCacheSize": get_session.cache_info().currsize,
    }


@app.post("/remove-background")
async def remove_background(
    image: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    quality: str = Form("1.0"),
):
    contents = await image.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image upload")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image upload is too large")

    selected_model = validate_model(model)

    try:
        session = get_session(selected_model)
        result = remove(
            contents,
            session=session,
            force_return_bytes=True,
            post_process_mask=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return Response(content=result, media_type="image/png")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
