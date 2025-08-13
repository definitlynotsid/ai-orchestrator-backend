"use client";

import { useState } from "react";

// Define the TypeScript types for our data
type WorkflowStep = {
  id: number;
  step_number: number;
  prompt: string;
};

type Workflow = {
  id: number;
  name: string;
  description: string;
  steps: WorkflowStep[];
};

// Define the props that this component will accept
interface WorkflowDesignerProps {
  workflows: Workflow[];
  selectedWorkflowId: number | null;
  onSelectWorkflow: (id: number) => void;
  onUpdate: () => void; // A function to tell the parent page to refresh data
}

export default function WorkflowDesigner({ workflows, selectedWorkflowId, onSelectWorkflow, onUpdate }: WorkflowDesignerProps) {
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [newStepPrompt, setNewStepPrompt] = useState("");

  // Updated backend URL - defaults to your deployed backend instead of localhost
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ai-orchestrator-backend.onrender.com';

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) return alert("Please enter a workflow name.");
    
    console.log('Creating workflow:', { name: newWorkflowName, description: newWorkflowDesc });
    console.log('Backend URL:', backendUrl);
    
    try {
      // Use the backendUrl variable for the API call
      const response = await fetch(`${backendUrl}/api/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkflowName, description: newWorkflowDesc }),
      });
      
      console.log('Create workflow response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Created workflow:', result);
        setNewWorkflowName("");
        setNewWorkflowDesc("");
        onUpdate(); // Tell the parent page to fetch workflows again
        alert(`Workflow "${newWorkflowName}" created successfully!`);
      } else {
        const errorText = await response.text();
        console.error('Failed to create workflow:', errorText);
        alert("Failed to create workflow.");
      }
    } catch (error) {
      console.error("Error creating workflow:", error);
      alert("Failed to connect to the backend. Please check your connection.");
    }
  };

  const handleAddStep = async () => {
    if (!selectedWorkflowId || !newStepPrompt.trim()) {
      return alert("Please select a workflow and enter a prompt for the step.");
    }
    const workflow = workflows.find(wf => wf.id === selectedWorkflowId);
    if (!workflow) return;

    const nextStepNumber = (workflow.steps?.length || 0) + 1;

    console.log('Adding step:', { step_number: nextStepNumber, prompt: newStepPrompt });

    try {
        // Use the backendUrl variable for the API call
        const response = await fetch(`${backendUrl}/api/workflows/${selectedWorkflowId}/steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step_number: nextStepNumber, prompt: newStepPrompt })
        });
        
        console.log('Add step response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Added step:', result);
            setNewStepPrompt('');
            onUpdate(); // Tell the parent page to fetch workflows again
            alert(`Step ${nextStepNumber} added successfully!`);
        } else {
            const errorText = await response.text();
            console.error('Failed to add step:', errorText);
            alert('Failed to add step.');
        }
    } catch (error) {
        console.error('Error adding step:', error);
        alert("Failed to connect to the backend. Please check your connection.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">1. Create a Workflow</h2>
        <div className="mt-4 space-y-4">
          <input 
            type="text" 
            value={newWorkflowName} 
            onChange={(e) => setNewWorkflowName(e.target.value)} 
            placeholder="Workflow Name (e.g., 'Blog Post Generator')" 
            className="w-full p-3 border rounded-lg" 
          />
          <textarea 
            value={newWorkflowDesc} 
            onChange={(e) => setNewWorkflowDesc(e.target.value)} 
            placeholder="Description..." 
            className="w-full p-3 border rounded-lg" 
            rows={2} 
          />
          <button 
            onClick={handleCreateWorkflow} 
            className="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700"
          >
            Create Workflow
          </button>
        </div>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">2. Add Steps</h2>
        <div className="mt-4 space-y-4">
          {workflows.length > 0 ? (
            workflows.map((wf) => (
              <div 
                key={wf.id} 
                className={`p-4 rounded-lg cursor-pointer border-2 ${selectedWorkflowId === wf.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`} 
                onClick={() => onSelectWorkflow(wf.id)}
              >
                <p className="font-bold text-gray-800">{wf.name}</p>
                <p className="text-sm text-gray-600">{wf.description}</p>
                {wf.steps && wf.steps.length > 0 && (
                    <ul className="mt-2 list-decimal list-inside text-sm text-gray-700 space-y-1">
                        {wf.steps.sort((a, b) => a.step_number - b.step_number).map(step => (
                            <li key={step.id}>
                              <span className="font-semibold">Step {step.step_number}:</span> {step.prompt}
                            </li>
                        ))}
                    </ul>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center">Create your first workflow to add steps.</p>
          )}
          {selectedWorkflowId && (
              <div className="pt-4 border-t">
                  <div className="flex items-center space-x-2">
                      <input 
                        type="text" 
                        value={newStepPrompt} 
                        onChange={(e) => setNewStepPrompt(e.target.value)} 
                        placeholder="Enter prompt for next step..." 
                        className="flex-grow p-3 border rounded-lg" 
                      />
                      <button 
                        onClick={handleAddStep} 
                        className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                      >
                        Add
                      </button>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}