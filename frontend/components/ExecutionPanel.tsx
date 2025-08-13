"use client";

import { useState, useRef } from "react";

type WorkflowResult = {
  step: number;
  prompt: string;
  result: string;
};

interface ExecutionPanelProps {
  selectedWorkflowId: number | null;
  workflowName: string | undefined;
}

export default function ExecutionPanel({ selectedWorkflowId, workflowName }: ExecutionPanelProps) {
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowResults, setWorkflowResults] = useState<WorkflowResult[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const lastStepResultRef = useRef<string>(""); // ✅ store last step result
  const wsRef = useRef<WebSocket | null>(null); // ✅ store WebSocket reference

  const handleRunWorkflow = () => {
    if (!selectedWorkflowId) return alert("Please select a workflow to run.");
    
    setIsWorkflowRunning(true);
    setWorkflowResults([]);
    setCurrentStatus("Connecting to workflow engine...");
    lastStepResultRef.current = "";

    const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ai-orchestrator-backend.onrender.com';
    const wsUrl = backendApiUrl.replace(/^https?/, (match) => match === 'https' ? 'wss' : 'ws');

    console.log('Connecting to WebSocket:', `${wsUrl}/ws/workflows/${selectedWorkflowId}/run`);
    
    const ws = new WebSocket(`${wsUrl}/ws/workflows/${selectedWorkflowId}/run`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection opened');
      setCurrentStatus("Connection established. Starting workflow...");
    };

    ws.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setCurrentStatus(data.message);
      } 
      else if (data.type === 'result') {
        // ✅ Save last step result for chaining
        lastStepResultRef.current = data.result;

        // ✅ Push to UI
        setWorkflowResults(prevResults => [...prevResults, data]);
      } 
      else if (data.type === 'nextStep') {
        // ✅ Automatically pass previous step's result to next step
        if (lastStepResultRef.current) {
          ws.send(JSON.stringify({ 
            type: 'stepInput', 
            content: lastStepResultRef.current 
          }));
        }
      } 
      else if (data.type === 'error') {
        setCurrentStatus(`Error: ${data.message}`);
        setIsWorkflowRunning(false);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      setCurrentStatus("Workflow finished. Connection closed.");
      setIsWorkflowRunning(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setCurrentStatus("Connection error. Please check if the backend is accessible.");
      setIsWorkflowRunning(false);
      wsRef.current = null;
    };
  };

  // ✅ Ensure WebSocket closes cleanly before unload to avoid async message error
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    });
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-gray-800">3. Run & See Results</h2>
      <button
        onClick={handleRunWorkflow}
        disabled={!selectedWorkflowId || isWorkflowRunning}
        className="mt-4 w-full px-6 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isWorkflowRunning ? "Running..." : `Run "${workflowName || 'Workflow'}"`}
      </button>
      
      <div className="mt-6 flex-grow space-y-4">
        {isWorkflowRunning && (
          <div className="text-center p-4 bg-blue-50 text-blue-700 rounded-lg">
            <p className="font-semibold">Live Status:</p>
            <p>{currentStatus}</p>
          </div>
        )}
        {workflowResults.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-700">Execution Results:</h3>
            {workflowResults.map((res, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border animate-fade-in">
                <p className="font-bold text-gray-800">
                  Step {res.step}: <span className="font-normal text-gray-600">{res.prompt}</span>
                </p>
                <div className="mt-2 p-3 bg-white rounded border text-gray-700 whitespace-pre-wrap">
                  {res.result}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

