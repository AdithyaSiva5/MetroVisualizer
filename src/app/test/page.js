"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import metroData from "../../../data/genData.json";

export default function MetroVisualizer() {
  const [currentTime, setCurrentTime] = useState(() => {
    // Use a static initial value to avoid SSR mismatch
    return "Loading...";
  });
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);

  useEffect(() => {
    // Start timer only on client after mount
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    }, 1000);
    // Set initial time on client mount
    setCurrentTime(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return () => clearInterval(timer);
  }, []); // Empty dependency array to run once on mount

  const isMetroClosed = () => {
    if (currentTime === "Loading...") return false; // Safe default during load
    const istTime = new Date(currentTime);
    const hours = istTime.getHours();
    return hours >= 23 || hours < 5;
  };

  const getMetroPosition = (trip) => {
    if (currentTime === "Loading...") return null; // Avoid calculation during load
    const istTime = new Date(currentTime);
    const currentSeconds = istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();

    const stopTimes = metroData.stop_times
      .filter((st) => st.trip_id === trip.trip_id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

    const baseTripDurationSeconds = 75 * 60; // Match with JSON
    const firstDeparture = timeToSeconds(stopTimes[0].departure_time);
    if (currentSeconds - firstDeparture > baseTripDurationSeconds) return null; // Trip too old

    for (let i = 0; i < stopTimes.length - 1; i++) {
      const startTime = timeToSeconds(stopTimes[i].departure_time);
      const endTime = timeToSeconds(stopTimes[i + 1].departure_time);
      if (currentSeconds >= startTime && currentSeconds < endTime) {
        const progress = (currentSeconds - startTime) / (endTime - startTime);
        const startDistance = stopTimes[i].shape_dist_traveled;
        const endDistance = stopTimes[i + 1].shape_dist_traveled;
        return startDistance + progress * (endDistance - startDistance);
      }
    }
    return null; // At terminal or invalid
  };

  const timeToSeconds = (timeStr) => {
    const [h, m, s] = timeStr.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };

  const getFare = (startId, endId) => {
    const rule = metroData.fares.fare_rules.find(
      (r) => r.origin_id === startId && r.destination_id === endId
    );
    if (!rule) return "No direct fare";
    const fare = metroData.fares.fare_attributes.find((f) => f.fare_id === rule.fare_id);
    return `₹${fare.price}`;
  };

  const handleStationClick = (stopId) => {
    if (!selectedStart) {
      setSelectedStart(stopId);
    } else if (!selectedEnd && stopId !== selectedStart) {
      setSelectedEnd(stopId);
    } else {
      setSelectedStart(stopId);
      setSelectedEnd(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
  };

  const totalRouteDistance = metroData.stop_times
    .filter((st) => st.trip_id === "T1" && st.stop_sequence === metroData.stops.length)
    .map((st) => st.shape_dist_traveled)[0] || 28000;

  const activeTrips = metroData.trips.map((trip) => getMetroPosition(trip)).filter((pos) => pos !== null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-8 text-cyan-400">Kochi Metro Live Tracker</h1>

      {isMetroClosed() ? (
        <div className="text-2xl font-semibold text-red-500 animate-pulse">
          Metro Closed (11 PM - 5 AM)
        </div>
      ) : activeTrips.length === 0 ? (
        <div className="text-2xl font-semibold text-yellow-500 animate-pulse">
          No Trains Running Right Now
        </div>
      ) : (
        <div className="w-full max-w-6xl relative">
          <div className="relative flex items-center justify-between">
            <div className="absolute w-full h-2 bg-cyan-500 rounded-full z-0" />
            {metroData.stops.map((stop) => (
              <div
                key={stop.stop_id}
                className="relative z-10 flex flex-col items-center"
                style={{ minWidth: `${100 / metroData.stops.length}%` }}
              >
                <motion.div
                  className={`w-5 h-5 rounded-full cursor-pointer flex items-center justify-center ${
                    selectedStart === stop.stop_id || selectedEnd === stop.stop_id
                      ? "bg-yellow-400"
                      : "bg-cyan-500"
                  }`}
                  whileHover={{ scale: 1.2 }}
                  onClick={() => handleStationClick(stop.stop_id)}
                >
                  <span className="text-xs">🚉</span>
                </motion.div>
                <span className="text-sm mt-2 text-center whitespace-nowrap">{stop.stop_name}</span>
              </div>
            ))}
            <AnimatePresence>
              {metroData.trips.map((trip) => {
                const position = getMetroPosition(trip);
                if (position === null) return null;
                const percentage = (position / totalRouteDistance) * 100;

                return (
                  <motion.div
                    key={trip.trip_id}
                    className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      trip.direction_id === 0
                        ? "bg-gradient-to-r from-cyan-400 to-blue-600"
                        : "bg-gradient-to-r from-purple-400 to-pink-600"
                    }`}
                    style={{ left: `${percentage}%`, top: trip.direction_id === 0 ? "-20px" : "20px" }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.5 }}
                  >
                    🚇
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {selectedStart && selectedEnd && (
            <motion.div
              className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg flex flex-col items-center max-w-md mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-lg text-center">
                Fare from{" "}
                <span className="font-bold">
                  {metroData.stops.find((s) => s.stop_id === selectedStart).stop_name}
                </span>{" "}
                to{" "}
                <span className="font-bold">
                  {metroData.stops.find((s) => s.stop_id === selectedEnd).stop_name}
                </span>
                : <span className="text-cyan-400">{getFare(selectedStart, selectedEnd)}</span>
              </p>
              <button
                onClick={handleClearSelection}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-300"
              >
                Clear Selection
              </button>
            </motion.div>
          )}
        </div>
      )}

      <p className="mt-6 text-sm text-gray-400">
        Current Time (IST): {currentTime}
      </p>
    </div>
  );
}
