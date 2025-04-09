"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import metroData from "../../data/metroData.json";

export default function MetroVisualizer() {
  const [currentTime, setCurrentTime] = useState(() => {
    // Static initial value for server rendering
    return new Date("2025-04-07T16:40:00Z"); // Matches your screenshot time, 10:40 PM IST
  });
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isMetroClosed = () => {
    const istTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const hours = istTime.getHours();
    return hours >= 23 || hours < 5;
  };

  const getMetroPosition = (trip) => {
    const istTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentSeconds = istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();

    const stopTimes = metroData.stop_times.filter((st) => st.trip_id === trip.trip_id);
    stopTimes.sort((a, b) => a.stop_sequence - b.stop_sequence);

    for (let i = 0; i < stopTimes.length - 1; i++) {
      const startTime = timeToSeconds(stopTimes[i].departure_time);
      const endTime = timeToSeconds(stopTimes[i + 1].arrival_time);
      if (currentSeconds >= startTime && currentSeconds <= endTime) {
        const progress = (currentSeconds - startTime) / (endTime - startTime);
        const startIndex = stopTimes[i].stop_sequence - 1;
        const endIndex = stopTimes[i + 1].stop_sequence - 1;
        return startIndex + progress * (endIndex - startIndex);
      }
    }
    return null;
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-cyan-400">Kochi Metro Live Tracker</h1>

      {isMetroClosed() ? (
        <div className="text-2xl font-semibold text-red-500 animate-pulse">
          Metro Closed (11 PM - 5 AM)
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          <div className="relative flex items-center justify-between">
            <div className="absolute w-full h-1 bg-cyan-500 rounded-full" />
            {metroData.stops.map((stop) => (
              <div key={stop.stop_id} className="relative z-10 flex flex-col items-center">
                <motion.div
                  className={`w-4 h-4 rounded-full cursor-pointer ${
                    selectedStart === stop.stop_id || selectedEnd === stop.stop_id
                      ? "bg-yellow-400"
                      : "bg-cyan-500"
                  }`}
                  whileHover={{ scale: 1.5 }}
                  onClick={() => handleStationClick(stop.stop_id)}
                />
                <span className="text-sm mt-2 text-center">{stop.stop_name}</span>
              </div>
            ))}
            <AnimatePresence>
              {metroData.trips.map((trip) => {
                const position = getMetroPosition(trip);
                if (position === null) return null;
                const totalStops = metroData.stops.length;
                const percentage = (position / (totalStops - 1)) * 100;

                return (
                  <motion.div
                    key={trip.trip_id}
                    className="absolute w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ left: `${percentage}%`, top: "-10px" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
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
              className="mt-8 p-4 bg-gray-800 rounded-lg shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-lg">
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
            </motion.div>
          )}
        </div>
      )}

      <p className="mt-4 text-sm text-gray-400">
        Current Time (IST): {currentTime.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}
      </p>
    </div>
  );
}