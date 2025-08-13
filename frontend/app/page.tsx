"use client";

import { useState, useEffect } from "react";
import WorkflowDesigner from "@/components/WorkflowDesigner";
import ExecutionPanel from "@/components/ExecutionPanel";

// Define the main Workflow type
type Workflow = {
  id: number;
  name: string;
  description: string;
  steps: { id: number; step_number: number; prompt: string }[];
};

export default function Home() {
  // The main page now only manages the core state
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // This function will be passed to the designer so it can tell us when to refresh
  const fetchWorkflows = async () => {
    try {
      // Updated backend URL - defaults to your deployed backend instead of localhost
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ai-orchestrator-backend.onrender.com';
      console.log('Fetching workflows from:', backendUrl); // Debug log
      
      const response = await fetch(`${backendUrl}/api/workflows`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Workflow[] = await response.json();
      console.log('Fetched workflows:', data); // Debug log
      
      setWorkflows(data);
      
      // If no workflow is selected but we have workflows, don't auto-select
      // Let user manually select
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
      // Optionally, you can add a state to show an error message to the user
    }
  };

  // Handle workflow selection with debug logging
  const handleSelectWorkflow = (id: number) => {
    console.log('Selecting workflow ID:', id); // Debug log
    setSelectedWorkflowId(id);
  };

  // Fetch the initial data when the page loads
  useEffect(() => {
    fetchWorkflows();
  }, []);
  
  const selectedWorkflow = workflows.find(wf => wf.id === selectedWorkflowId);
  console.log('Currently selected workflow:', selectedWorkflow); // Debug log

  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-12 bg-gray-50">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-gray-800">
          AI Orchestration Platform
        </h1>
        
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: The Workflow Designer Component */}
          <WorkflowDesigner 
            workflows={workflows}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={handleSelectWorkflow}
            onUpdate={fetchWorkflows}
          />

          {/* Right Column: The Execution Panel Component */}
          <ExecutionPanel 
            selectedWorkflowId={selectedWorkflowId}
            workflowName={selectedWorkflow?.name}
          />
        </div>
      </div>
    </main>
  );
}