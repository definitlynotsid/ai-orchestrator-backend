from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session

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

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your frontend domain if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check (for Render)
@app.get("/health", status_code=200)
def health_check():
    return {"status": "ok"}

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










