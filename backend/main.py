import os
import asyncio
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

# ------------------ Database Setup ------------------
DATABASE_URL = "sqlite:///./workflows.db"  # Change if using Postgres/MySQL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    steps = relationship("Step", back_populates="workflow", cascade="all, delete-orphan")

class Step(Base):
    __tablename__ = "steps"
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"))
    prompt = Column(Text, nullable=False)
    result = Column(Text, nullable=True)
    progress = Column(Integer, nullable=True)
    workflow = relationship("Workflow", back_populates="steps")

Base.metadata.create_all(bind=engine)

# ------------------ Schemas ------------------
class StepCreate(BaseModel):
    prompt: str
    result: Optional[str] = None
    progress: Optional[int] = None

class StepResponse(StepCreate):
    id: int
    class Config:
        orm_mode = True

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkflowResponse(WorkflowCreate):
    id: int
    steps: List[StepResponse] = []
    class Config:
        orm_mode = True

# ------------------ FastAPI App ------------------
app = FastAPI()

# Health check (for Render)
@app.get("/health", status_code=200)
def health_check():
    return {"status": "ok"}

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your frontend domain if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------ Workflow Routes ------------------
@app.get("/api/workflows", response_model=List[WorkflowResponse])
def get_workflows(db: Session = Depends(get_db)):
    return db.query(Workflow).all()

@app.post("/api/workflows", response_model=WorkflowResponse)
def create_workflow(workflow: WorkflowCreate, db: Session = Depends(get_db)):
    db_workflow = Workflow(**workflow.dict())
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

@app.get("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf

# ------------------ Step Routes ------------------
@app.post("/api/workflows/{workflow_id}/steps", response_model=StepResponse)
def add_step(workflow_id: int, step: StepCreate, db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db_step = Step(workflow_id=workflow_id, **step.dict())
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step

@app.get("/api/workflows/{workflow_id}/steps", response_model=List[StepResponse])
def get_steps(workflow_id: int, db: Session = Depends(get_db)):
    return db.query(Step).filter(Step.workflow_id == workflow_id).all()

# ------------------ Gemini AI Integration ------------------
try:
    import google.generativeai as genai  # type: ignore
except Exception:  # pragma: no cover - optional dependency at runtime
    genai = None  # type: ignore

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

_gemini_model = None
if genai and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(GEMINI_MODEL)
    except Exception:
        _gemini_model = None

from typing import Optional

async def generate_ai_text(prompt: str, previous_output: Optional[str] = None) -> str:
    if not _gemini_model:
        return f"[AI disabled] {prompt}"
    full_prompt = prompt if not previous_output else (
        f"Previous result:\n{previous_output}\n\nNew instruction:\n{prompt}"
    )
    def _call() -> str:
        try:
            res = _gemini_model.generate_content(full_prompt)
            return getattr(res, "text", "") or "[empty result]"
        except Exception as e:  # pragma: no cover
            return f"[AI error] {e}"
    return await asyncio.to_thread(_call)

# ------------------ WebSocket: Run Workflow ------------------
@app.websocket("/ws/workflows/{workflow_id}/run")
async def ws_run_workflow(ws: WebSocket, workflow_id: int):
    await ws.accept()
    db = SessionLocal()
    stop = asyncio.Event()

    async def _heartbeat() -> None:
        while not stop.is_set():
            try:
                await asyncio.sleep(20)
                await ws.send_json({"type": "ping"})
            except Exception:
                break

    hb = asyncio.create_task(_heartbeat())
    try:
        wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not wf:
            await ws.send_json({"type": "error", "message": "Workflow not found", "status": 404})
            return

        steps = db.query(Step).filter(Step.workflow_id == workflow_id).order_by(Step.id.asc()).all()
        await ws.send_json({"type": "status", "message": f"Started workflow {wf.id} with {len(steps)} steps"})

        previous_output: Optional[str] = None
        for idx, step in enumerate(steps, start=1):
            await ws.send_json({"type": "status", "message": f"Generating step {idx}"})
            result_text = await generate_ai_text(step.prompt, previous_output)

            step.result = result_text
            step.progress = 100
            db.add(step)
            db.commit()
            db.refresh(step)

            await ws.send_json({
                "type": "result",
                "step": idx,
                "prompt": step.prompt,
                "result": result_text
            })
            previous_output = result_text

        await ws.send_json({"type": "status", "message": "Workflow complete"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        stop.set()
        hb.cancel()
        db.close()
        try:
            await ws.close()
        except Exception:
            pass