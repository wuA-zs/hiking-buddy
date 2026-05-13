import type { AgentTool } from "../agent/types";
import { getLocationTool } from "./get-location";
import { getTrailInfoTool } from "./get-trail-info";
import { getWeatherTool } from "./get-weather";
import { searchNearbyTool } from "./search-nearby";
import { routePlanningTool } from "./route-planning";
import { travelPlannerTool } from "./travel-planner";

export function createHikingTools(): AgentTool[] {
  return [getLocationTool, searchNearbyTool, getWeatherTool, getTrailInfoTool, routePlanningTool, travelPlannerTool];
}
