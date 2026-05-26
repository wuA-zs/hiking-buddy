import type { AgentTool, Skill } from "../agent/types";
import { getLocationTool } from "./get-location";
import { getTrailInfoTool } from "./get-trail-info";
import { getWeatherTool } from "./get-weather";
import { searchNearbyTool } from "./search-nearby";
import { routePlanningTool } from "./route-planning";
import { travelPlannerTool } from "./travel-planner";
import { createLoadSkillTool } from "./load-skill";
import { listFilesTool } from "./list-files";
import { readFileTool } from "./read-file";
import { createFileTool } from "./create-file";
import { updateFileTool } from "./update-file";
import { deleteFileTool } from "./delete-file";

export function createHikingTools(getSkills: () => Skill[]): AgentTool[] {
  return [
    getLocationTool,
    searchNearbyTool,
    getWeatherTool,
    getTrailInfoTool,
    routePlanningTool,
    travelPlannerTool,
    createLoadSkillTool(getSkills),
    listFilesTool,
    readFileTool,
    createFileTool,
    updateFileTool,
    deleteFileTool,
  ];
}
