export interface WorkflowAppDefinition {
  id: string;
  label: string;
  appId: string;
  inputDescription: string;
  defaultPrompt: string;
}

export const workflowApps: WorkflowAppDefinition[] = [
  {
    id: "seethrough",
    label: "SeeThrough分层",
    appId: "2040054307541749762",
    inputDescription: "上传图片image",
    defaultPrompt: "SeeThrough分层"
  },
  {
    id: "seethroughv1",
    label: "seethroughv1",
    appId: "2039976277867761666",
    inputDescription: "image",
    defaultPrompt: "seethroughv1"
  },
  {
    id: "seethrough8673",
    label: "SeeThrough8673",
    appId: "2042526067000348673",
    inputDescription: "上传图片",
    defaultPrompt: "SeeThrough8673"
  }
];

export const defaultWorkflowAppId = workflowApps[0].id;

export function getWorkflowApp(id: string): WorkflowAppDefinition | undefined {
  return workflowApps.find((app) => app.id === id);
}

export function getWorkflowAppOrDefault(id: string): WorkflowAppDefinition {
  return getWorkflowApp(id) ?? workflowApps[0];
}
