"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import metroData from "../../data/genData.json";

export default function MetroVisualizer() {
  const [currentTime, setCurrentTime] = useState("Loading...");
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [showPathAnimation, setShowPathAnimation] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [trainArrivals, setTrainArrivals] = useState({});
  const [isMobileView, setIsMobileView] = useState(false);
  const [showJourneyPopup, setShowJourneyPopup] = useState(false);
  const [viewMode, setViewMode] = useState("vertical"); // "vertical" or "map" or "perspective"
  const [focusedStation, setFocusedStation] = useState(null);

  // Effects
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      updateTrainArrivals();
    }, 1000);
    setCurrentTime(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    updateTrainArrivals();
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  useEffect(() => {
    if (selectedStart && selectedEnd) {
      setShowPathAnimation(true);
      setShowJourneyPopup(true); // Show popup on both PC and mobile
    } else {
      setShowPathAnimation(false);
      setShowJourneyPopup(false);
    }
  }, [selectedStart, selectedEnd]);

  useEffect(() => {
    // If switching to perspective view, initialize focused station if needed
    if (viewMode === "perspective" && !focusedStation) {
      setFocusedStation(metroData.stops[0].stop_id);
    }
  }, [viewMode, focusedStation]);

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

  const updateTrainArrivals = () => {
    if (currentTime === "Loading...") return;
    const arrivals = {};
    metroData.stops.forEach((station) => {
      const stationId = station.stop_id;
      const stationArrivals = [];
      metroData.trips.forEach((trip) => {
        const arrival = calculateTrainArrival(trip, stationId);
        if (arrival && arrival.minutes <= 30) {
          stationArrivals.push({
            tripId: trip.trip_id,
            directionId: trip.direction_id,
            minutes: arrival.minutes,
            destination: trip.direction_id === 0
              ? metroData.stops[metroData.stops.length - 1].stop_name
              : metroData.stops[0].stop_name,
          });
        }
      });
      stationArrivals.sort((a, b) => a.minutes - b.minutes);
      arrivals[stationId] = stationArrivals.slice(0, 3);
    });
    setTrainArrivals(arrivals);
  };

  const calculateTrainArrival = (trip, stationId) => {
    const istTime = new Date(currentTime);
    const currentSeconds = istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();
    const stopTimes = metroData.stop_times
      .filter((st) => st.trip_id === trip.trip_id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);
    const stationStopTime = stopTimes.find((st) => st.stop_id === stationId);
    if (!stationStopTime) return null;
    const arrivalTimeSeconds = timeToSeconds(stationStopTime.arrival_time);
    if (currentSeconds > arrivalTimeSeconds) return null;
    const secondsUntilArrival = arrivalTimeSeconds - currentSeconds;
    const minutesUntilArrival = Math.ceil(secondsUntilArrival / 60);
    return { tripId: trip.trip_id, minutes: minutesUntilArrival };
  };

  const getMetroPosition = (trip) => {
    if (currentTime === "Loading...") return null;
    const istTime = new Date(currentTime);
    const currentSeconds = istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();
    const stopTimes = metroData.stop_times
      .filter((st) => st.trip_id === trip.trip_id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);
    
    if (stopTimes.length === 0) return null;
    
    const baseTripDurationSeconds = 75 * 60;
    const firstDeparture = timeToSeconds(stopTimes[0].departure_time);
    if (currentSeconds - firstDeparture > baseTripDurationSeconds || currentSeconds < firstDeparture) return null;
    
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
    return null;
  };

  const getFare = (startId, endId) => {
    const rule = metroData.fares?.fare_rules?.find((r) => r.origin_id === startId && r.destination_id === endId);
    if (rule) {
      const fare = metroData.fares.fare_attributes.find((f) => f.fare_id === rule.fare_id);
      return fare ? `₹${fare.price}` : "N/A";
    }
    const startIndex = metroData.stops.findIndex((s) => s.stop_id === startId);
    const endIndex = metroData.stops.findIndex((s) => s.stop_id === endId);
    if (startIndex === -1 || endIndex === -1) return "N/A";
    const distance = Math.abs(endIndex - startIndex);
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
    
    if (!selectedStart) setSelectedStart(stopId);
    else if (!selectedEnd && stopId !== selectedStart) setSelectedEnd(stopId);
    else {
      setSelectedStart(stopId);
      setSelectedEnd(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setShowJourneyPopup(false); // Ensure popup closes on clear
  };

  const getEstimatedTime = () => {
    if (!selectedStart || !selectedEnd) return null;
    const startIndex = metroData.stops.findIndex((s) => s.stop_id === selectedStart);
    const endIndex = metroData.stops.findIndex((s) => s.stop_id === selectedEnd);
    if (startIndex === -1 || endIndex === -1) return "N/A";
    const stations = Math.abs(endIndex - startIndex);
    const minutes = stations * 4;
    return `${minutes} minutes`;
  };

  const getDistanceBetweenStations = () => {
    if (!selectedStart || !selectedEnd) return null;
    const startStopTime = metroData.stop_times.find((st) => st.trip_id === "T1" && st.stop_id === selectedStart);
    const endStopTime = metroData.stop_times.find((st) => st.trip_id === "T1" && st.stop_id === selectedEnd);
    if (startStopTime && endStopTime && startStopTime.shape_dist_traveled !== undefined && endStopTime.shape_dist_traveled !== undefined) {
      const distanceMeters = Math.abs(endStopTime.shape_dist_traveled - startStopTime.shape_dist_traveled);
      return `${(distanceMeters / 1000).toFixed(1)} km`;
    }
    const startIndex = metroData.stops.findIndex((s) => s.stop_id === selectedStart);
    const endIndex = metroData.stops.findIndex((s) => s.stop_id === selectedEnd);
    if (startIndex === -1 || endIndex === -1) return "N/A";
    const stations = Math.abs(endIndex - startIndex);
    const distance = (stations * 1.2).toFixed(1);
    return `${distance} km`;
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const findStationIndex = (stopId) => metroData.stops.findIndex((s) => s.stop_id === stopId);

  const toggleViewMode = () => {
    if (viewMode === "vertical") {
      setViewMode("map");
    } else if (viewMode === "map") {
      setViewMode("perspective");
      setSelectedStart(null);
      setSelectedEnd(null);
      if (!focusedStation) {
        setFocusedStation(metroData.stops[0].stop_id);
      }
    } else {
      setViewMode("vertical");
    }
  };

  // Focused station for perspective view
  const focusedStationData = focusedStation ? 
    metroData.stops.find(s => s.stop_id === focusedStation) : null;
  
  const focusedStationIndex = focusedStationData ? 
    metroData.stops.findIndex(s => s.stop_id === focusedStation) : 0;

  const activeTrips = metroData.trips
    .map((trip) => {
      const positionData = getMetroPosition(trip);
      return positionData ? { ...trip, positionData } : null;
    })
    .filter((trip) => trip !== null);

  const totalRouteDistance = metroData.stop_times
    .filter((st) => st.trip_id === "T1")
    .sort((a, b) => b.stop_sequence - a.stop_sequence)[0]?.shape_dist_traveled || 28000;

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
      danger: "bg-red-500 hover:bg-red-600",
    },
  };

  const getPathHighlightBounds = () => {
    if (!selectedStart || !selectedEnd) return { top: 0, height: 0 };
    const startIndex = findStationIndex(selectedStart);
    const endIndex = findStationIndex(selectedEnd);
    const totalStations = metroData.stops.length - 1;
    
    // Ensure highlight starts from the smaller index station and ends at the larger
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    const topPercentage = (minIndex / totalStations) * 100;
    const heightPercentage = ((maxIndex - minIndex) / totalStations) * 100;
    
    return { top: `${topPercentage}%`, height: `${heightPercentage}%` };
  };

  const getNextTrainArrival = (stationId) => trainArrivals[stationId]?.[0] || null;

  function getTrackPosition(startId, endId) {
    if (!startId || !endId) return "calc(50% - 10px)";
    const startIndex = metroData.stops.findIndex((s) => s.stop_id === startId);
    const endIndex = metroData.stops.findIndex((s) => s.stop_id === endId);
    if (startIndex < endIndex) return "calc(50% + 8px)"; // Right track (Tripunithura-bound)
    return "calc(50% - 12px)"; // Left track (Aluva-bound)
  }

  // Convert coordinates to screen positions for map view
  const mapStationPosition = (index, total) => {
    // For vertical line
    return {
      x: 50, // center of container
      y: (index / (total - 1)) * 90 + 5 // 5% to 95% of container height
    };
  };

  // Find the nearest train to the focused station
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
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col transition-colors duration-500 w-full`}>
      {/* Header */}
      <header className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center z-10">
        <div className="flex items-center space-x-2">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="text-3xl">
            🚇
          </motion.div>
          <div>
            <h1 className={`text-2xl md:text-4xl font-bold ${theme.accent}`}>Kochi Metro</h1>
            <p className={`text-sm ${theme.secondary}`}>Real-time Tracker & Journey Planner</p>
          </div>
        </div>
        <div className="flex space-x-2 mt-3 md:mt-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleViewMode}
            className={`px-3 py-2 rounded-lg ${theme.button.primary} text-white flex items-center space-x-2`}
          >
            <span>{viewMode === "vertical" ? "🗺️" : viewMode === "map" ? "👁️" : "📊"}</span>
            <span>{viewMode === "vertical" ? "Metro Map" : viewMode === "map" ? "Station View" : "Vertical View"}</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={`px-3 py-2 rounded-full ${theme.button.secondary} flex items-center`}
          >
            {isDarkMode ? "☀️" : "🌙"}
          </motion.button>
        </div>
      </header>

      {/* Metro Status Banner */}
      <div className="px-4 md:px-6 py-2">
        {isMetroClosed() ? (
          <motion.div animate={{ opacity: 1 }} className="text-center py-2 px-4 rounded-lg bg-red-500/20 text-red-300 font-semibold animate-pulse">
            ⚠️ Metro Closed (11 PM - 5 AM)
          </motion.div>
        ) : activeTrips.length === 0 ? (
          <motion.div animate={{ opacity: 1 }} className="text-center py-2 px-4 rounded-lg bg-yellow-500/20 text-yellow-300 font-semibold animate-pulse">
            ⏱️ No Trains Running Right Now
          </motion.div>
        ) : (
          <motion.div animate={{ opacity: 1 }} className="text-center py-2 px-4 rounded-lg bg-green-500/20 text-green-300 font-semibold">
            ✅ {activeTrips.length} Train{activeTrips.length !== 1 ? "s" : ""} Running
          </motion.div>
        )}
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 flex justify-center px-2 md:px-6 py-4">
        {viewMode === "vertical" ? (
          // Vertical Line View
          <div className={`relative w-full max-w-3xl mx-auto ${theme.card} p-4 md:p-6 rounded-xl shadow-xl ${theme.shadow} overflow-hidden ${isMobileView ? "flex-col" : ""}`}>
            <div className="relative py-4 flex flex-col items-center w-full">
              {/* Central Divider */}
              <div className="absolute h-full w-6 bg-gray-700 rounded-full z-0 left-1/2 -translate-x-1/2"></div>
              {/* Left Track (Aluva-bound) */}
              <div className={`absolute h-full w-2 ${theme.line} rounded-full z-0`} style={{ left: "calc(50% - 10px)" }}></div>
              {/* Right Track (Tripunithura-bound) */}
              <div className={`absolute h-full w-2 ${theme.line} rounded-full z-0`} style={{ left: "calc(50% + 8px)" }}></div>
              {/* Railway Sleepers */}
              {Array.from({ length: 50 }).map((_, i) => (
                <div key={i} className="absolute w-12 h-1 bg-gray-600 z-0 left-1/2 -translate-x-1/2" style={{ top: `${(i * 2) + 1}%` }} />
              ))}
              {/* Selected Path Highlight */}
              {selectedStart && selectedEnd && showPathAnimation && (
                <motion.div
                  initial={{ height: "0%" }}
                  animate={{ height: getPathHighlightBounds().height }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute bg-yellow-400 rounded-full z-0"
                  style={{ 
                    width: "4px", 
                    left: getTrackPosition(selectedStart, selectedEnd), 
                    top: getPathHighlightBounds().top 
                  }}
                />
              )}
              {/* Stations */}
              <div className="relative z-10 space-y-16 md:space-y-24 w-full">
                {metroData.stops.map((stop, index) => {
                  const isSelectedStart = selectedStart === stop.stop_id;
                  const isSelectedEnd = selectedEnd === stop.stop_id;
                  const nodeColor = isSelectedStart
                    ? "bg-green-500"
                    : isSelectedEnd
                    ? "bg-orange-500"
                    : "bg-cyan-500";
                  const textColor = isSelectedStart
                    ? "text-green-500"
                    : isSelectedEnd
                    ? "text-orange-500"
                    : theme.text;
                  const arrival = getNextTrainArrival(stop.stop_id);

                  return (
                    <div key={stop.stop_id} className="flex items-center justify-center">
                      <div className="group flex items-center w-full">
                        {/* Left side (Station Name & ETA) */}
                        <div className="flex-1 text-right mr-4">
                          <motion.div
                            onClick={() => handleStationClick(stop.stop_id)}
                            className={`inline-block cursor-pointer ${isSelectedStart ? "bg-green-500/20" : isSelectedEnd ? "bg-orange-500/20" : ""} px-3 py-2 rounded-lg transition-colors duration-300`}
                            whileHover={{ scale: 1.05 }}
                          >
                            <div className={`${textColor} font-semibold`}>{stop.stop_name}</div>
                            <div className={`${theme.secondary} text-xs`}>{stop.stop_id}</div>
                            {arrival && <div className={`text-xs mt-1 ${arrival.minutes <= 1 ? "text-red-400 animate-pulse" : "text-green-400"}`}>Next: {arrival.minutes <= 1 ? "Arriving" : `${arrival.minutes} min`}</div>}
                          </motion.div>
                        </div>
                        {/* Station Node */}
                        <motion.div
                          onClick={() => handleStationClick(stop.stop_id)}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center z-20 cursor-pointer ${nodeColor}`}
                        >
                          {isSelectedStart ? (
                            <span className="text-sm text-white">🔸</span>
                          ) : isSelectedEnd ? (
                            <span className="text-sm text-white">🔹</span>
                          ) : (
                            <span className="w-2 h-2 bg-white rounded-full"></span>
                          )}
                        </motion.div>
                        {/* Right side (Station Name & ETA) */}
                        <div className="flex-1 ml-4">
                          <motion.div
                            onClick={() => handleStationClick(stop.stop_id)}
                            className={`inline-block cursor-pointer ${isSelectedStart ? "bg-green-500/20" : isSelectedEnd ? "bg-orange-500/20" : ""} px-3 py-2 rounded-lg transition-colors duration-300`}
                            whileHover={{ scale: 1.05 }}
                          >
                            <div className={`${textColor} font-semibold`}>{stop.stop_name}</div>
                            <div className={`${theme.secondary} text-xs`}>{stop.stop_id}</div>
                            {arrival && <div className={`text-xs mt-1 ${arrival.minutes <= 1 ? "text-red-400 animate-pulse" : "text-green-400"}`}>Next: {arrival.minutes <= 1 ? "Arriving" : `${arrival.minutes} min`}</div>}
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Animated Trains */}
              <AnimatePresence>
                {activeTrips.map((trip) => {
                  const stationCount = metroData.stops.length;
                  const currentStopIndex = findStationIndex(trip.positionData.currentStop);
                  const nextStopIndex = findStationIndex(trip.positionData.nextStop);
                  const percentage = ((currentStopIndex + (trip.positionData.progress || 0) * (nextStopIndex - currentStopIndex)) / (stationCount - 1)) * 100;
                  const trackPosition = trip.direction_id === 0 ? { left: "calc(50% + 8px)" } : { left: "calc(50% - 12px)" };
                  return (
                    <motion.div
                      key={trip.trip_id}
                      className="absolute z-30"
                      style={{ 
                        top: `${Math.max(0, Math.min(100, percentage))}%`, 
                        ...trackPosition,
                        width: "16px",
                        height: "16px"
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {/* Updated train visualization */}
                      <div className={`relative ${
                        trip.direction_id === 0
                          ? "bg-gradient-to-r from-blue-500 to-blue-700"
                          : "bg-gradient-to-r from-purple-500 to-purple-700"
                      } rounded-md w-[30px] h-[16px] -translate-x-1/2 shadow-md flex items-center justify-center border border-white/30`}>
                        {/* Train windows */}
                        <div className="absolute inset-y-1 mx-1 flex space-x-0.5">
                          <div className="w-1 h-2 bg-yellow-100/80 rounded-sm"></div>
                          <div className="w-1 h-2 bg-yellow-100/80 rounded-sm"></div>
                          <div className="w-1 h-2 bg-yellow-100/80 rounded-sm"></div>
                        </div>
                        
                        {/* Train ID in tooltip */}
                        <div className="absolute -top-6 bg-black/70 px-1 py-0.5 rounded text-xs text-white whitespace-nowrap">
                          {trip.trip_id}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : viewMode === "map" ? (
          // Metro Map View
          <div className={`relative w-full max-w-5xl mx-auto ${theme.card} p-4 md:p-6 rounded-xl shadow-xl ${theme.shadow} overflow-hidden h-[600px] md:h-[700px]`}>
            <div className="absolute inset-0 p-4">
              {/* Main metro line */}
              <div className="absolute h-[90%] w-4 bg-cyan-500 rounded-full z-0 left-1/2 -translate-x-1/2 top-[5%]"></div>
              
              {/* Path highlight for selected journey */}
              {selectedStart && selectedEnd && (
                <motion.div
                  initial={{ height: "0%" }}
                  animate={{ height: getPathHighlightBounds().height }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute w-4 bg-yellow-400 rounded-full z-1"
                  style={{ 
                    left: "50%",
                    transform: "translateX(-50%)",
                    top: getPathHighlightBounds().top
                  }}
                />
              )}
              
              {/* Stations */}
              {metroData.stops.map((stop, index) => {
                const position = mapStationPosition(index, metroData.stops.length);
                const isSelectedStart = selectedStart === stop.stop_id;
                const isSelectedEnd = selectedEnd === stop.stop_id;
                const stationColor = isSelectedStart 
                  ? "bg-green-500" 
                  : isSelectedEnd 
                  ? "bg-orange-500" 
                  : "bg-cyan-700";
                const arrival = getNextTrainArrival(stop.stop_id);
                
                return (
                  <div key={stop.stop_id} className="absolute" style={{ 
                    left: `${position.x}%`, 
                    top: `${position.y}%`, 
                    transform: "translate(-50%, -50%)",
                    zIndex: 10
                  }}>
                    <div className="flex items-center">
                      {/* Left Station Label */}
                      <div className="text-right mr-3 w-[120px]">
                        <motion.div
                          onClick={() => handleStationClick(stop.stop_id)}
                          whileHover={{ scale: 1.05 }}
                          className={`inline-block cursor-pointer text-right py-1 px-2 rounded ${
                            isSelectedStart ? "bg-green-500/20" : 
                            isSelectedEnd ? "bg-orange-500/20" : ""
                          }`}
                        >
                          <div className="font-medium text-sm">{stop.stop_name}</div>
                          <div className="text-xs text-gray-500">{stop.stop_id}</div>
                          {arrival && 
                            <div className={`text-xs ${arrival.minutes <= 1 ? "text-red-400 animate-pulse" : "text-green-400"}`}>
                              {arrival.minutes <= 1 ? "Arriving" : `${arrival.minutes}m`}
                            </div>
                          }
                        </motion.div>
                      </div>
                      
                      {/* Station Node */}
                      <motion.div
                        onClick={() => handleStationClick(stop.stop_id)}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className={`w-8 h-8 ${stationColor} rounded-full flex items-center justify-center cursor-pointer z-20 border-2 border-gray-800`}
                      >
                        {isSelectedStart ? (
                          <span className="text-sm text-white">🔸</span>
                        ) : isSelectedEnd ? (
                          <span className="text-sm text-white">🔹</span>
                        ) : (
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                        )}
                      </motion.div>
                      
                      {/* Right Station Label */}
                      <div className="ml-3 w-[120px]">
                        <motion.div
                          onClick={() => handleStationClick(stop.stop_id)}
                          whileHover={{ scale: 1.05 }}
                          className={`inline-block cursor-pointer text-left py-1 px-2 rounded ${
                            isSelectedStart ? "bg-green-500/20" : 
                            isSelectedEnd ? "bg-orange-500/20" : ""
                          }`}
                        >
                          <div className="font-medium text-sm">{index % 2 === 0 ? "Platform " + (index + 1) : ""}</div>
                          <div className="text-xs text-gray-500">
                            {arrival && (
                              <span className={arrival.minutes <= 1 ? "text-red-400 animate-pulse" : "text-green-400"}>
                                {arrival.minutes <= 1 ? "Arriving" : `${arrival.minutes}m`}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Animated Trains */}
              <AnimatePresence>
                {activeTrips.map((trip) => {
                  const stationCount = metroData.stops.length;
                  const currentStopIndex = findStationIndex(trip.positionData.currentStop);
                  const nextStopIndex = findStationIndex(trip.positionData.nextStop);
                  const progress = trip.positionData.progress || 0;
                  
                  // Calculate position along the line
                  const currentPos = mapStationPosition(currentStopIndex, stationCount);
                  const nextPos = mapStationPosition(nextStopIndex, stationCount);
                  
                  const yPos = currentPos.y + progress * (nextPos.y - currentPos.y);
                  
                  // Offset x position based on direction
                  const xOffset = trip.direction_id === 0 ? 2 : -2; // pixel offset
                  
                  return (
                    <motion.div
                      key={trip.trip_id}
                      className="absolute z-30"
                      style={{ 
                        left: `calc(${currentPos.x}% ${xOffset > 0 ? `+${xOffset}px` : ''+xOffset+'px'})`,   
                        top: `${yPos}%`,
                        transform: "translate(-50%, -50%)",
                        width: "30px",
                        height: "16px"
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {/* Train visualization */}
                      <div className={`relative ${
                        trip.direction_id === 0
                          ? "bg-gradient-to-r from-blue-500 to-blue-700"
                          : "bg-gradient-to-r from-purple-500 to-purple-700"
                      } rounded-md w-full h-full flex items-center justify-center border border-white/30`}>
                        {/* Train windows */}
                        <div className="absolute inset-y-1 mx-1 flex space-x-0.5">
                          <div className="w-1 h-2 bg-yellow-100/80 rounded-sm"></div>
                          <div className="w-1 h-2 bg-yellow-100/80 rounded-sm"></div>
                          <div className="w-1 h-2 bg-yellow-100/80 rounded-sm"></div>
                        </div>
                        
                        {/* Train ID */}
                        <div className={`absolute ${trip.direction_id === 0 ? "-top-6" : "-bottom-6"} bg-black/70 px-1 py-0.5 rounded text-xs text-white whitespace-nowrap`}>
                          {trip.trip_id}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            
              {/* Map Legend */}
              <div className="absolute bottom-4 right-4 bg-black/60 p-2 rounded-lg z-20">
                <div className="text-sm font-semibold mb-1">Legend</div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <div>To {metroData.stops[metroData.stops.length - 1].stop_name}</div>
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <div>To {metroData.stops[0].stop_name}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Perspective Station View
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
                      <div className={`w-4 h-6 ${bodyColor} rounded-sm`}></div>
                      
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

      {/* Journey Info Popup */}
      <AnimatePresence>
        {showJourneyPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className={`p-4 ${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-lg shadow-lg w-11/12 max-w-md max-h-[80vh] overflow-y-auto border border-gray-600`}
            >
              <h3 className="text-lg font-bold mb-3">Journey Details</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="mr-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <span>🔸</span>
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
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                      <span>🔹</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">To</div>
                    <div className="font-semibold">
                      {metroData.stops.find((s) => s.stop_id === selectedEnd)?.stop_name || selectedEnd}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"} rounded-lg`}>
                    <div className="text-xs text-gray-500">Fare</div>
                    <div className={`text-base font-bold ${theme.accent}`}>{getFare(selectedStart, selectedEnd)}</div>
                  </div>
                  <div className={`p-2 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"} rounded-lg`}>
                    <div className="text-xs text-gray-500">Distance</div>
                    <div className={`text-base font-bold ${theme.accent}`}>{getDistanceBetweenStations()}</div>
                  </div>
                  <div className={`p-2 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"} rounded-lg`}>
                    <div className="text-xs text-gray-500">Est. Time</div>
                    <div className={`text-base font-bold ${theme.accent}`}>{getEstimatedTime()}</div>
                  </div>
                </div>
                <div className="flex justify-between mt-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClearSelection}
                    className={`px-3 py-1.5 ${theme.button.danger} text-white rounded-lg shadow transition duration-300`}
                  >
                    <span className="mr-1">🔄</span>
                    Clear
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowJourneyPopup(false)}
                    className={`px-3 py-1.5 ${theme.button.secondary} rounded-lg shadow transition duration-300`}
                  >
                    <span className="mr-1">✕</span>
                    Close
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className={`p-4 text-center ${theme.secondary} flex flex-col md:flex-row justify-between items-center ${isMobileView ? "text-sm" : ""}`}>
        <div><span className="mr-2">⏰</span>Current Time (IST): {currentTime}</div>
        <div className="mt-2 md:mt-0">Kochi Metro | Information subject to change</div>
      </footer>
    </div>
  );
}
