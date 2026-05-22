import { ViewProps } from "react-native";

export interface POIMarker {
  id: string;
  name: string;
  type?: string;
  latitude: number;
  longitude: number;
  address?: string;
  distance?: number;
  direction?: string;
}

export interface AmapViewProps extends ViewProps {
  apiKey?: string;
  initialCenter?: {
    latitude: number;
    longitude: number;
  };
  zoomLevel?: number;
  markers?: POIMarker[];
  showsUserLocation?: boolean;
  onMarkerTap?: (event: { nativeEvent: POIMarker }) => void;
}
