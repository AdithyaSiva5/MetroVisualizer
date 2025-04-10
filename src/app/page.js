"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import metroData from "../../data/genData.json";

export default function MetroVisualizer() {
  // States for the application
  const [currentTime, setCurrentTime] = useState("Loading...");
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [showPathAnimation, setShowPathAnimation] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [focusedStation, setFocusedStation] = useState(null);
  const [showPerspectiveView, setShowPerspectiveView] = useState(false);
  const [viewMode, setViewMode] = useState("vertical"); // "vertical" or "perspective"
  
  // Effects
  useEffect(() => {
    // Start timer only on client after mount
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    }, 1000);
    // Set initial time on client mount
    setCurrentTime(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedStart && selectedEnd) {
      setShowPathAnimation(true);
    } else {
      setShowPathAnimation(false);
    }
  }, [selectedStart, selectedEnd]);

  // Helper functions
  const isMetroClosed = () => {
    if (currentTime === "Loading...") return false;
    const istTime = new Date(currentTime);
    const hours = istTime.getHours();
    return hours >= 23 || hours < 5;
  };

  const timeToSeconds = (timeStr) => {
    const [h, m, s] = timeStr.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };

  const getMetroPosition = (trip) => {
    if (currentTime === "Loading...") return null;
    const istTime = new Date(currentTime);
    const currentSeconds = istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();

    const stopTimes = metroData.stop_times
      .filter((st) => st.trip_id === trip.trip_id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

    if (stopTimes.length === 0) return null;

    const baseTripDurationSeconds = 75 * 60; // Match with JSON
    const firstDeparture = timeToSeconds(stopTimes[0].departure_time);
    
    // Check if the trip is too old
    if (currentSeconds - firstDeparture > baseTripDurationSeconds) return null;
    
    // Check if the trip hasn't started yet
    if (currentSeconds < firstDeparture) return null;

    for (let i = 0; i < stopTimes.length - 1; i++) {
      const startTime = timeToSeconds(stopTimes[i].departure_time);
      const endTime = timeToSeconds(stopTimes[i + 1].arrival_time);
      
      if (currentSeconds >= startTime && currentSeconds <= endTime) {
        const progress = (currentSeconds - startTime) / (endTime - startTime);
        const startDistance = stopTimes[i].shape_dist_traveled || 0;
        const endDistance = stopTimes[i + 1].shape_dist_traveled || 0;
        
        return {
          position: startDistance + progress * (endDistance - startDistance),
          currentStop: stopTimes[i].stop_id,
          nextStop: stopTimes[i + 1].stop_id,
          progress: progress,
          startStopIndex: i,
          nextStopIndex: i + 1
        };
      }
    }
    
    return null; // Train not currently on the route or at terminal
  };

  const getFare = (startId, endId) => {
    // Try to find a specific fare rule
    const rule = metroData.fares?.fare_rules?.find(
      (r) => r.origin_id === startId && r.destination_id === endId
    );
    
    if (rule) {
      const fare = metroData.fares.fare_attributes.find((f) => f.fare_id === rule.fare_id);
      return fare ? `₹${fare.price}` : "N/A";
    }
    
    // Calculate based on distance if no fare rules match
    const startIndex = metroData.stops.findIndex(s => s.stop_id === startId);
    const endIndex = metroData.stops.findIndex(s => s.stop_id === endId);
    
    if (startIndex === -1 || endIndex === -1) return "N/A";
    
    const distance = Math.abs(endIndex - startIndex);
    
    // Simple fare calculation based on station distance
    if (distance <= 2) return "₹10";
    if (distance <= 4) return "₹20";
    if (distance <= 6) return "₹30";
    if (distance <= 10) return "₹40";
    return "₹50";
  };

  const handleStationClick = (stopId) => {
    if (viewMode === "perspective") {
      setFocusedStation(stopId);
      return;
    }
    
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

  const getEstimatedTime = () => {
    if (!selectedStart || !selectedEnd) return null;
    
    const startIndex = metroData.stops.findIndex(s => s.stop_id === selectedStart);
    const endIndex = metroData.stops.findIndex(s => s.stop_id === selectedEnd);
    
    if (startIndex === -1 || endIndex === -1) return "N/A";
    
    const stations = Math.abs(endIndex - startIndex);
    
    // Average time between stations is about 3-4 minutes
    const minutes = stations * 4;
    return `${minutes} minutes`;
  };

  const getDistanceBetweenStations = () => {
    if (!selectedStart || !selectedEnd) return null;
    
    // Try to get actual distance from shape_dist_traveled
    const startStopTime = metroData.stop_times.find(st => st.trip_id === "T1" && st.stop_id === selectedStart);
    const endStopTime = metroData.stop_times.find(st => st.trip_id === "T1" && st.stop_id === selectedEnd);
    
    if (startStopTime && endStopTime && 
        startStopTime.shape_dist_traveled !== undefined && 
        endStopTime.shape_dist_traveled !== undefined) {
      const distanceMeters = Math.abs(endStopTime.shape_dist_traveled - startStopTime.shape_dist_traveled);
      return `${(distanceMeters / 1000).toFixed(1)} km`;
    }
    
    // Fallback to estimation by station count
    const startIndex = metroData.stops.findIndex(s => s.stop_id === selectedStart);
    const endIndex = metroData.stops.findIndex(s => s.stop_id === selectedEnd);
    
    if (startIndex === -1 || endIndex === -1) return "N/A";
    
    const stations = Math.abs(endIndex - startIndex);
    const distance = (stations * 1.2).toFixed(1); // Rough estimate
    return `${distance} km`;
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleViewMode = () => {
    if (viewMode === "vertical") {
      setViewMode("perspective");
      setSelectedStart(null);
      setSelectedEnd(null);
      setFocusedStation(metroData.stops[0].stop_id);
    } else {
      setViewMode("vertical");
      setFocusedStation(null);
    }
  };

  const findStationIndex = (stopId) => {
    return metroData.stops.findIndex(s => s.stop_id === stopId);
  };

  // Generate active trips based on time
  const activeTrips = metroData.trips
    .map(trip => {
      const positionData = getMetroPosition(trip);
      return positionData ? {
        ...trip,
        positionData
      } : null;
    })
    .filter(trip => trip !== null);

  // Focused station for perspective view
  const focusedStationData = focusedStation ? 
    metroData.stops.find(s => s.stop_id === focusedStation) : null;
  
  const focusedStationIndex = focusedStationData ? 
    metroData.stops.findIndex(s => s.stop_id === focusedStation) : 0;

  // Calculate the total route distance for visualization
  const lastStopTime = metroData.stop_times
    .filter(st => st.trip_id === "T1")
    .sort((a, b) => b.stop_sequence - a.stop_sequence)[0];
    
  const totalRouteDistance = lastStopTime ? lastStopTime.shape_dist_traveled : 28000;

  // Theme based on dark/light mode
  const theme = {
    bg: isDarkMode ? "bg-gray-900" : "bg-gray-100",
    text: isDarkMode ? "text-white" : "text-gray-900",
    accent: isDarkMode ? "text-cyan-400" : "text-blue-600",
    secondary: isDarkMode ? "text-gray-400" : "text-gray-600",
    card: isDarkMode ? "bg-gray-800" : "bg-white",
    line: isDarkMode ? "bg-cyan-500" : "bg-blue-600",
    shadow: isDarkMode ? "shadow-cyan-900/30" : "shadow-gray-400/30",
    button: {
      primary: isDarkMode ? "bg-cyan-600 hover:bg-cyan-700" : "bg-blue-600 hover:bg-blue-700",
      secondary: isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300",
      danger: "bg-red-500 hover:bg-red-600"
    }
  };

  // Find trains arriving at focused station
  const trainsAtFocusedStation = focusedStation ? activeTrips.filter(trip => {
    return trip.positionData.currentStop === focusedStation || 
           trip.positionData.nextStop === focusedStation;
  }) : [];

  // Determine the nearest train and its ETA to focused station
  const findNearestTrainToStation = (stationId) => {
    if (!stationId) return null;
    
    const stationIndex = findStationIndex(stationId);
    
    // Filter to find trains heading toward this station
    const approachingTrains = activeTrips.filter(trip => {
      const currentStopIndex = findStationIndex(trip.positionData.currentStop);
      const nextStopIndex = findStationIndex(trip.positionData.nextStop);
      
      // For direction 0, train is going from lower index to higher index
      if (trip.direction_id === 0) {
        return currentStopIndex < stationIndex && stationIndex <= nextStopIndex;
      } 
      // For direction 1, train is going from higher index to lower index
      else {
        return currentStopIndex > stationIndex && stationIndex >= nextStopIndex;
      }
    });
    
    if (approachingTrains.length === 0) return null;
    
    // Find the nearest approaching train
    return approachingTrains.reduce((nearest, train) => {
      const trainPosition = train.positionData.position;
      const stationPosition = metroData.stop_times.find(
        st => st.trip_id === "T1" && st.stop_id === stationId
      )?.shape_dist_traveled || 0;
      
      const distance = Math.abs(trainPosition - stationPosition);
      
      if (!nearest || distance < nearest.distance) {
        // Calculate estimated arrival time
        const speed = 1000; // meters per minute (estimated)
        const timeMinutes = Math.ceil(distance / speed);
        
        return {
          train,
          distance,
          eta: timeMinutes <= 1 ? "Arriving" : `${timeMinutes} min`
        };
      }
      return nearest;
    }, null);
  };
  
  const nearestTrain = findNearestTrainToStation(focusedStation);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col transition-colors duration-500 w-full overflow-x-hidden`}>
      {/* Header */}
      <header className={`p-4 md:p-6 flex flex-col md:flex-row justify-between items-center z-10`}>
        <div className="flex items-center space-x-2">
          <motion.div 
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="text-3xl"
          >
            🚇
          </motion.div>
          <div>
            <h1 className={`text-2xl md:text-4xl font-bold ${theme.accent}`}>Kochi Metro</h1>
            <p className={`text-sm ${theme.secondary}`}>Real-time Tracker & Journey Planner</p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 mt-4 md:mt-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={`px-3 py-2 rounded-full ${theme.button.secondary} flex items-center space-x-2`}
          >
            <span>{isDarkMode ? '☀️' : '🌙'}</span>
            <span className="hidden md:inline">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleViewMode}
            className={`px-3 py-2 rounded-full ${theme.button.primary} text-white flex items-center space-x-2`}
          >
            <span>{viewMode === "vertical" ? '🔄' : '🔙'}</span>
            <span className="hidden md:inline">{viewMode === "vertical" ? 'Station View' : 'Metro Map'}</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowInfo(!showInfo)}
            className={`px-3 py-2 rounded-full ${theme.button.secondary} flex items-center space-x-2`}
          >
            <span>ℹ️</span>
            <span className="hidden md:inline">Info</span>
          </motion.button>
        </div>
      </header>

      {/* Metro Status Banner */}
      <div className="px-4 md:px-6 py-2">
        {isMetroClosed() ? (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center py-2 px-4 rounded-lg bg-red-500/20 text-red-300 font-semibold animate-pulse`}
          >
            <span className="mr-2">⚠️</span> Metro Closed (11 PM - 5 AM)
          </motion.div>
        ) : activeTrips.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center py-2 px-4 rounded-lg bg-yellow-500/20 text-yellow-300 font-semibold animate-pulse`}
          >
            <span className="mr-2">⏱️</span> No Trains Running Right Now
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center py-2 px-4 rounded-lg bg-green-500/20 text-green-300 font-semibold`}
          >
            <span className="mr-2">✅</span> {activeTrips.length} Train{activeTrips.length !== 1 ? 's' : ''} Currently Running
          </motion.div>
        )}
      </div>

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mx-4 md:mx-6 my-2 p-4 rounded-lg ${theme.card} overflow-hidden`}
          >
            <h3 className="text-lg font-semibold mb-2">How to use:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Toggle between Metro Map and Station View to see different perspectives</li>
              <li>In Metro Map: Click on any station to select it as your starting point, then click another for destination</li>
              <li>In Station View: Experience trains arriving at stations from a platform perspective</li>
              <li>Watch trains move in real-time along the metro line</li>
            </ul>
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Legend:</h3>
              <div className="flex flex-col md:flex-row md:space-x-4 space-y-2 md:space-y-0">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 mr-2"></div>
                  <span>Trains heading to {metroData.stops[metroData.stops.length-1]?.stop_name || 'Terminal'}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-400 to-pink-600 mr-2"></div>
                  <span>Trains heading to {metroData.stops[0]?.stop_name || 'Terminal'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Visualization Area */}
      <div className="flex-1 flex justify-center px-2 md:px-6 py-4">
        {viewMode === "vertical" ? (
          /* Vertical Metro Map View */
          <div className={`relative w-full max-w-3xl mx-auto ${theme.card} p-4 md:p-6 rounded-xl shadow-xl ${theme.shadow} overflow-hidden flex justify-center`}>
            <div className="relative py-4 flex flex-col items-center">
              {/* Vertical Metro Line */}
              <div className={`absolute h-full w-4 ${theme.line} rounded-full z-0 left-1/2 -translate-x-1/2`}></div>
              
              {/* Selected Path Highlight */}
              {selectedStart && selectedEnd && showPathAnimation && (
                <motion.div
                  initial={{ height: "0%" }}
                  animate={{ height: "100%" }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute h-full w-6 bg-gradient-to-b from-yellow-400 to-orange-500 rounded-full z-0 left-1/2 -translate-x-1/2"
                  style={{
                    top: `${(findStationIndex(selectedStart) / (metroData.stops.length - 1)) * 100}%`,
                    height: `${(Math.abs(findStationIndex(selectedEnd) - findStationIndex(selectedStart)) / (metroData.stops.length - 1)) * 100}%`
                  }}
                />
              )}
              
              {/* Stations */}
              <div className="relative z-10 space-y-8 md:space-y-12 w-full">
                {metroData.stops.map((stop, index) => (
                  <div
                    key={stop.stop_id}
                    className="flex items-center justify-center"
                  >
                    <div 
                      className="group flex items-center cursor-pointer w-full"
                      onClick={() => handleStationClick(stop.stop_id)}
                    >
                      <div className="flex-1 text-right mr-4">
                        <motion.div 
                          className={`inline-block ${
                            selectedStart === stop.stop_id ? 'bg-green-500/20 text-green-300' : 
                            selectedEnd === stop.stop_id ? 'bg-orange-500/20 text-orange-300' : 
                            'bg-transparent'
                          } px-2 py-1 rounded-lg transition-colors duration-300`}
                          whileHover={{ scale: 1.05 }}
                        >
                          <span className="font-semibold">{stop.stop_name}</span>
                          <div className={`text-xs ${theme.secondary}`}>{stop.stop_id}</div>
                        </motion.div>
                      </div>
                      
                      <motion.div
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center z-20 ${
                          selectedStart === stop.stop_id 
                            ? 'bg-gradient-to-r from-green-400 to-emerald-600 ring-2 ring-green-300/30' 
                            : selectedEnd === stop.stop_id 
                              ? 'bg-gradient-to-r from-red-400 to-orange-600 ring-2 ring-red-300/30' 
                              : `${theme.line} hover:bg-cyan-400`
                        }`}
                      >
                        {(selectedStart === stop.stop_id || selectedEnd === stop.stop_id) ? (
                          <span className="text-xs">🏁</span>
                        ) : (
                          <span className="w-3 h-3 bg-white rounded-full"></span>
                        )}
                      </motion.div>
                      
                      <div className="flex-1 ml-4">
                        {/* Station amenities/details on the right */}
                        <div className="flex space-x-2">
                          {/* We could add icons here for station facilities */}
                          {index % 3 === 0 && (
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded">🅿️ Parking</span>
                          )}
                          {index % 4 === 0 && (
                            <span className="text-xs bg-green-500/20 text-green-300 px-1 py-0.5 rounded">🚌 Bus</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Animated Trains */}
              <AnimatePresence>
                {activeTrips.map((trip) => {
                  // Calculate percentage based on the trip's position
                  const stationCount = metroData.stops.length;
                  const currentStopIndex = findStationIndex(trip.positionData.currentStop);
                  const nextStopIndex = findStationIndex(trip.positionData.nextStop);
                  const percentage = ((currentStopIndex + (trip.positionData.progress || 0) * (nextStopIndex - currentStopIndex)) / (stationCount - 1)) * 100;
                  
                  return (
                    <motion.div
                      key={trip.trip_id}
                      className={`absolute w-16 h-10 z-30 left-1/2 ${
                        trip.direction_id === 0 ? "-translate-x-20" : "translate-x-4"
                      }`}
                      style={{ 
                        top: `${Math.max(0, Math.min(100, percentage))}%`,
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        x: trip.direction_id === 0 ? [-2, 2, -2] : [2, -2, 2],
                      }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ 
                        duration: 0.5,
                        x: {
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }
                      }}
                    >
                      <div 
                        className={`relative ${
                          trip.direction_id === 0
                            ? "bg-gradient-to-b from-cyan-400 to-blue-600"
                            : "bg-gradient-to-b from-purple-400 to-pink-600"
                        } rounded-md w-full h-full shadow-lg flex items-center justify-center overflow-hidden`}
                      >
                        {/* Train windows */}
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3/4 flex flex-col justify-around">
                          <motion.div 
                            className="h-1.5 bg-white/50 rounded-full"
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <motion.div 
                            className="h-1.5 bg-white/50 rounded-full"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                          />
                        </div>
                        
                        <div className="flex items-center justify-center z-10">
                          <span className="text-[8px] md:text-xs font-bold text-white">
                            {trip.trip_id}
                          </span>
                        </div>
                        
                        {/* Direction indicator */}
                        <div className={`absolute ${trip.direction_id === 0 ? "bottom-0" : "top-0"} inset-x-0 h-1.5 bg-yellow-400/70`}></div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Journey Info Card */}
            <AnimatePresence>
              {selectedStart && selectedEnd && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`absolute bottom-4 right-4 p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-lg shadow-lg max-w-xs overflow-hidden`}
                >
                  <div className="relative z-10">
                    {/* Background Animation */}
                    <div className="absolute inset-0 -z-10 overflow-hidden">
                      <motion.div 
                        className={`absolute w-40 h-40 rounded-full ${isDarkMode ? 'bg-cyan-600/10' : 'bg-blue-400/10'} -top-20 -right-20`}
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.3, 0.5, 0.3],
                        }}
                        transition={{
                          duration: 8,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </div>
                    
                    <h3 className="text-lg font-bold mb-3">Journey Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center">
                        <div className="mr-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                            <span className="text-xs">🏁</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">From</div>
                          <div className="font-semibold">
                            {metroData.stops.find((s) => s.stop_id === selectedStart)?.stop_name || selectedStart}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <div className="mr-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-orange-600 flex items-center justify-center">
                            <span className="text-xs">🏁</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">To</div>
                          <div className="font-semibold">
                            {metroData.stops.find((s) => s.stop_id === selectedEnd)?.stop_name || selectedEnd}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                          <div className="text-xs text-gray-500">Fare</div>
                          <div className={`text-base font-bold ${theme.accent}`}>
                            {getFare(selectedStart, selectedEnd)}
                          </div>
                        </div>
                        
                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                          <div className="text-xs text-gray-500">Distance</div>
                          <div className={`text-base font-bold ${theme.accent}`}>
                            {getDistanceBetweenStations()}
                          </div>
                        </div>
                        
                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                          <div className="text-xs text-gray-500">Est. Time</div>
                          <div className={`text-base font-bold ${theme.accent}`}>
                            {getEstimatedTime()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-center mt-3">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleClearSelection}
                          className={`px-3 py-1.5 ${theme.button.danger} text-white rounded-lg shadow transition duration-300 flex items-center space-x-1 text-sm`}
                        >
                          <span>🔄</span>
                          <span>Clear</span>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Station Perspective View */
          <div className={`relative w-full max-w-4xl mx-auto ${theme.card} p-4 md:p-6 rounded-xl shadow-xl ${theme.shadow} overflow-hidden flex flex-col h-[500px] md:h-[600px]`}>
            {/* Station Selection Navbar */}
            <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2 no-scrollbar">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const currentIndex = focusedStationIndex;
                  const prevIndex = Math.max(0, currentIndex - 1);
                  setFocusedStation(metroData.stops[prevIndex].stop_id);
                }}
                className={`px-3 py-2 rounded-lg ${theme.button.secondary} flex-shrink-0 ${focusedStationIndex <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={focusedStationIndex <= 0}
              >
                ◀ Previous
              </motion.button>
              
              <div className="flex-1 px-4 overflow-hidden">
                <div className="flex space-x-2 justify-center">
                  {metroData.stops.map((stop, idx) => (
                    <motion.div
                      key={stop.stop_id}
                      className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                        stop.stop_id === focusedStation 
                          ? 'w-8 bg-cyan-400' 
                          : 'w-2 bg-gray-600 hover:bg-gray-500'
                      }`}
                      onClick={() => setFocusedStation(stop.stop_id)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    />
                  ))}
                </div>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const currentIndex = focusedStationIndex;
                  const nextIndex = Math.min(metroData.stops.length - 1, currentIndex + 1);
                  setFocusedStation(metroData.stops[nextIndex].stop_id);
                }}
                className={`px-3 py-2 rounded-lg ${theme.button.secondary} flex-shrink-0 ${focusedStationIndex >= metroData.stops.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={focusedStationIndex >= metroData.stops.length - 1}
              >
                Next ▶
              </motion.button>
            </div>
            
            {/* Station Name */}
            <div className="text-center mb-4">
              <motion.h2 
                key={focusedStation}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-2xl md:text-3xl font-bold"
              >
                {focusedStationData?.stop_name || "Station"}
              </motion.h2>
              <p className={`text-sm ${theme.secondary}`}>
                {focusedStationData?.stop_id || ""}
                {nearestTrain && (
                  <span className="ml-2 inline-flex items-center bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                    <span className="animate-pulse mr-1">⏱️</span> 
                    Next train: {nearestTrain.eta}
                  </span>
                )}
              </p>
            </div>
            
            {/* 3D Perspective View */}
            <div className="flex-grow relative overflow-hidden rounded-lg">
              {/* Background - Sky and cityscape */}
              <div className={`absolute inset-0 ${isDarkMode ? 'bg-gradient-to-b from-gray-900 via-blue-900 to-indigo-900' : 'bg-gradient-to-b from-blue-300 via-blue-200 to-cyan-100'}`}>
                {/* Buildings and city elements */}
                <div className="absolute bottom-0 w-full h-1/3">
                  {/* Generate random buildings */}
                  {Array.from({ length: 20 }).map((_, i) => {
                    const width = 4 + Math.random() * 6;
                    const height = 10 + Math.random() * 40;
                    const left = (i * 5) + Math.random() * 2;
                    const buildingColor = isDarkMode 
                      ? ['bg-gray-800', 'bg-gray-700', 'bg-gray-900'][Math.floor(Math.random() * 3)]
                      : ['bg-gray-200', 'bg-gray-300', 'bg-gray-100'][Math.floor(Math.random() * 3)];
                    
                    return (
                      <div 
                        key={i}
                        className={`absolute bottom-0 ${buildingColor} rounded-t-sm`}
                        style={{ 
                          width: `${width}%`, 
                          height: `${height}%`, 
                          left: `${left}%`,
                          opacity: 0.7
                        }}
                      >
                        {/* Windows */}
                        {Array.from({ length: Math.floor(height/8) }).map((_, j) => (
                          <div key={j} className="flex justify-around w-full mt-1">
                            {Array.from({ length: Math.floor(width) }).map((_, k) => (
                              <div 
                                key={k}
                                className={`w-1 h-1 ${isDarkMode && Math.random() > 0.3 ? 'bg-yellow-300' : 'bg-gray-500'} rounded-full`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                
                {/* Sun/Moon */}
                <div 
                  className={`absolute rounded-full ${isDarkMode ? 'bg-gray-300' : 'bg-yellow-300'}`}
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    top: '15%', 
                    right: '15%',
                    boxShadow: isDarkMode ? '0 0 20px rgba(255,255,255,0.3)' : '0 0 40px rgba(255,193,7,0.5)'
                  }}
                />

                {/* Cloud/Star elements */}
                {isDarkMode ? (
                  // Stars at night
                  Array.from({ length: 50 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute bg-white rounded-full"
                      style={{ 
                        width: Math.random() > 0.9 ? '2px' : '1px', 
                        height: Math.random() > 0.9 ? '2px' : '1px', 
                        top: `${Math.random() * 50}%`,
                        left: `${Math.random() * 100}%`,
                      }}
                      animate={{ 
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 2 + Math.random() * 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: Math.random() * 5
                      }}
                    />
                  ))
                ) : (
                  // Clouds during day
                  Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute bg-white rounded-full opacity-80"
                      style={{ 
                        width: `${50 + Math.random() * 100}px`, 
                        height: `${25 + Math.random() * 50}px`, 
                        top: `${10 + Math.random() * 30}%`,
                        filter: 'blur(10px)',
                      }}
                      initial={{ 
                        left: `${-20}%`,
                      }}
                      animate={{ 
                        left: `${120}%`,
                      }}
                      transition={{
                        duration: 60 + Math.random() * 60,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 60
                      }}
                    />
                  ))
                )}
              </div>
              
              {/* Platform */}
              <div className="absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t from-gray-700 to-gray-900 perspective-element">
                {/* Platform marking and details */}
                <div className="absolute inset-x-0 top-0 h-4 bg-yellow-500"></div>
                
                {/* Platform number */}
                <div className="absolute top-10 left-10 bg-blue-800 text-white px-4 py-2 rounded-lg">
                  Platform {(focusedStationIndex % 2) + 1}
                </div>
                
                {/* Safety line */}
                <div className="absolute inset-x-0 top-8 h-2 bg-gray-300 border-t-2 border-b-2 border-dashed border-red-500"></div>
                
                {/* Station name on platform */}
                <div className="absolute top-12 right-10">
                  <div className="bg-blue-800 text-white px-3 py-1 rounded-lg text-sm">
                    {focusedStationData?.stop_name}
                  </div>
                </div>
              </div>
              
              {/* Tracks */}
              <div className="absolute bottom-[25%] inset-x-0 h-6 bg-gray-800 perspective-element">
                <div className="absolute inset-x-0 top-1/2 h-1 bg-gray-600"></div>
                <div className="absolute inset-x-0 bottom-0 h-2 bg-gray-700"></div>
                
                {/* Track sleepers (railroad ties) */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute h-full w-4 bg-gray-700"
                    style={{ left: `${(i * 5) + 2.5}%` }}
                  ></div>
                ))}
              </div>
              
              {/* Pillars */}
              <div className="absolute bottom-[30%] inset-x-0 perspective-element">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute bottom-0 w-8 bg-gray-400 rounded-t-lg"
                    style={{ 
                      left: `${(i * 25)}%`,
                      height: '100vh'
                    }}
                  ></div>
                ))}
              </div>
              
              {/* Direction signs */}
              <div className="absolute top-10 inset-x-0 flex justify-between px-10">
                <div className="bg-blue-800 text-white px-3 py-1 rounded-lg text-sm flex items-center">
                  ◀ To {metroData.stops[0]?.stop_name}
                </div>
                <div className="bg-blue-800 text-white px-3 py-1 rounded-lg text-sm flex items-center">
                  To {metroData.stops[metroData.stops.length - 1]?.stop_name} ▶
                </div>
              </div>
              
              {/* Train approaching animation */}
              <AnimatePresence>
                {nearestTrain && (
                  <motion.div
                    key={`train-${nearestTrain.train.trip_id}`}
                    className="absolute bottom-[25%] h-16"
                    style={{ 
                      width: '70%',
                      perspective: '1000px',
                      zIndex: 20
                    }}
                    initial={{ 
                      right: nearestTrain.train.direction_id === 0 ? '-100%' : '100%',
                      opacity: 0
                    }}
                    animate={{ 
                      right: nearestTrain.eta === "Arriving" ? '15%' : (nearestTrain.train.direction_id === 0 ? '-80%' : '80%'),
                      opacity: 1,
                      z: 0
                    }}
                    exit={{ 
                      right: nearestTrain.train.direction_id === 0 ? '100%' : '-100%',
                      opacity: 0,
                      transition: { duration: 5 }
                    }}
                    transition={{ 
                      duration: nearestTrain.eta === "Arriving" ? 3 : 0.5,
                      ease: "easeInOut"
                    }}
                  >
                    {/* Perspective train visualization */}
                    <div className={`relative h-full rounded-lg overflow-hidden shadow-lg ${
                      nearestTrain.train.direction_id === 0
                        ? "bg-gradient-to-r from-cyan-600 to-blue-700"
                        : "bg-gradient-to-r from-purple-600 to-pink-700"
                    }`}
                    style={{
                      transform: `rotateY(${nearestTrain.train.direction_id === 0 ? '-5deg' : '5deg'})`,
                      transformStyle: 'preserve-3d'
                    }}
                    >
                      {/* Train front */}
                      <div className={`absolute ${
                        nearestTrain.train.direction_id === 0 ? "right-0" : "left-0"
                      } top-0 h-full w-[15%] ${
                        nearestTrain.train.direction_id === 0
                          ? "bg-gradient-to-l from-cyan-600 to-blue-800"
                          : "bg-gradient-to-r from-purple-600 to-pink-800"
                      } rounded-lg`}>
                        {/* Train lights */}
                        <div className="absolute top-1/4 h-2 w-2 bg-yellow-300 rounded-full shadow-lg shadow-yellow-300/50"
                          style={{
                            left: nearestTrain.train.direction_id === 0 ? 'auto' : '25%',
                            right: nearestTrain.train.direction_id === 0 ? '25%' : 'auto'
                          }}
                        ></div>
                        <div className="absolute bottom-1/4 h-2 w-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50"
                          style={{
                            left: nearestTrain.train.direction_id === 0 ? 'auto' : '25%',
                            right: nearestTrain.train.direction_id === 0 ? '25%' : 'auto'
                          }}
                        ></div>
                      </div>
                      
                      {/* Train body with windows */}
                      <div className="absolute inset-y-0 w-[70%]"
                        style={{
                          left: nearestTrain.train.direction_id === 0 ? '15%' : '15%'
                        }}
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute top-1/4 h-1/2 bg-yellow-100/80 rounded-sm"
                            style={{ 
                              width: '15%', 
                              left: `${(i * 20) + 2.5}%`,
                            }}
                            animate={{
                              opacity: [0.7, 0.9, 0.7]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.2
                            }}
                          >
                            {/* Passenger silhouettes */}
                            {Math.random() > 0.3 && (
                              <div className="absolute bottom-1/4 w-1/2 h-1/2 bg-gray-800/50 rounded-full mx-auto left-0 right-0"></div>
                            )}
                          </motion.div>
                        ))}
                        
                        {/* Train ID */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/80 text-blue-900 px-2 py-0.5 rounded text-xs font-bold">
                          {nearestTrain.train.trip_id}
                        </div>
                      </div>
                    </div>
                    
                    {/* Train approaching lighting effect on track */}
                    {nearestTrain.eta === "Arriving" && (
                      <motion.div
                        className="absolute -bottom-4 inset-x-0 h-4 bg-yellow-300/30 blur-md rounded-full"
                        animate={{
                          opacity: [0.3, 0.7, 0.3]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity
                        }}
                      ></motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Platform people */}
              <div className="absolute bottom-[25%] inset-x-0">
                {Array.from({ length: 8 }).map((_, i) => {
                  const left = 10 + (i * 10) + (Math.random() * 5);
                  const personHeight = 12 + Math.random() * 4;
                  const isMale = Math.random() > 0.5;
                  const bodyColor = ['bg-blue-600', 'bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-600'][Math.floor(Math.random() * 5)];
                  
                  return (
                    <motion.div
                      key={i}
                      className="absolute bottom-0"
                      style={{
                        left: `${left}%`,
                        zIndex: Math.floor(Math.random() * 10)
                      }}
                      animate={{
                        y: [0, -2, 0]
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2
                      }}
                    >
                      {/* Head */}
                      <div className="w-4 h-4 bg-orange-200 rounded-full"></div>
                      
                      {/* Body */}
                      <div className={`w-4 h-${personHeight} ${bodyColor} rounded-sm`}></div>
                      
                      {/* Legs */}
                      <div className="flex">
                        <div className="w-1.5 h-4 bg-gray-700 rounded-b-sm"></div>
                        <div className="w-1.5 h-4 bg-gray-700 rounded-b-sm ml-1"></div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Station Info Panel */}
            <div className={`mt-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-white/70'} flex justify-between items-center`}>
              <div className="flex flex-col md:flex-row md:items-center">
                <span className={`${theme.secondary} text-sm`}>
                  <span className="mr-1">🏢</span> 
                  Station {focusedStationIndex + 1} of {metroData.stops.length}
                </span>
                
                <span className="hidden md:inline mx-2">•</span>
                
                <div className={`${theme.secondary} text-sm`}>
                  <span className="mr-1">⏱️</span>
                  Services: 05:00 - 23:00
                </div>
              </div>
              
              <div className="flex space-x-2">
                {(focusedStationIndex % 3 === 0) && (
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded flex items-center">
                    <span className="mr-1">🅿️</span> Parking
                  </span>
                )}
                {(focusedStationIndex % 4 === 0) && (
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded flex items-center">
                    <span className="mr-1">🚌</span> Bus
                  </span>
                )}
                {(focusedStationIndex % 5 === 0) && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded flex items-center">
                    <span className="mr-1">🏪</span> Shop
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Current Time */}
      <footer className={`p-4 text-center ${theme.secondary} flex flex-col md:flex-row justify-between items-center`}>
        <div className="text-sm">
          <span className="mr-2">⏰</span> Current Time (IST): {currentTime}
        </div>
        <div className="text-sm mt-2 md:mt-0">
          Kochi Metro | Information subject to change
        </div>
      </footer>
    </div>
  );
}
