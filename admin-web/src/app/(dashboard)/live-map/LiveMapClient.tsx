"use client";

import { Fragment } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

type Stop = {
  customer_id: string;
  customer_name: string;
  visit_sequence: number;
  latitude: number | null;
  longitude: number | null;
  status: "visited" | "pending";
};

type AgentEntry = {
  agent_id: string;
  agent_name: string;
  trip_id: string;
  trip_status: string;
  vehicle_reg_no: string | null;
  last_location: { latitude: number; longitude: number; recorded_at: string } | null;
  beat_name: string | null;
  stops: Stop[];
};

// India-wide default view, used when there's nothing live to center on yet.
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

export default function LiveMapClient({ agents }: { agents: AgentEntry[] }) {
  const located = agents.filter((a) => a.last_location);
  const center: [number, number] = located.length
    ? [located[0].last_location!.latitude, located[0].last_location!.longitude]
    : DEFAULT_CENTER;
  const zoom = located.length ? 12 : DEFAULT_ZOOM;

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: "600px", width: "100%" }} className="rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {agents.map((agent) => (
        <Fragment key={agent.agent_id}>
          {agent.last_location && (
            <CircleMarker
              center={[agent.last_location.latitude, agent.last_location.longitude]}
              radius={9}
              pathOptions={{ color: "#4f46e5", fillColor: "#6366f1", fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>
                <strong>{agent.agent_name}</strong>
                <br />
                Trip: {agent.trip_status}
                {agent.vehicle_reg_no && (
                  <>
                    <br />
                    Vehicle: {agent.vehicle_reg_no}
                  </>
                )}
                {agent.beat_name && (
                  <>
                    <br />
                    Route: {agent.beat_name}
                  </>
                )}
                <br />
                Last seen: {new Date(agent.last_location.recorded_at).toLocaleTimeString()}
              </Popup>
            </CircleMarker>
          )}
          {agent.stops
            .filter((s) => s.latitude !== null && s.longitude !== null)
            .map((stop) => (
              <CircleMarker
                key={stop.customer_id}
                center={[stop.latitude as number, stop.longitude as number]}
                radius={6}
                pathOptions={
                  stop.status === "visited"
                    ? { color: "#059669", fillColor: "#10b981", fillOpacity: 0.8 }
                    : { color: "#d97706", fillColor: "#f59e0b", fillOpacity: 0.8 }
                }
              >
                <Popup>
                  <strong>
                    #{stop.visit_sequence} {stop.customer_name}
                  </strong>
                  <br />
                  {stop.status === "visited" ? "Visited" : "Not yet visited"} — {agent.agent_name}
                </Popup>
              </CircleMarker>
            ))}
        </Fragment>
      ))}
    </MapContainer>
  );
}
