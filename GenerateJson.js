const fs = require("fs");

const stops = [
  { stop_id: "ALVA", stop_name: "Aluva" },
  { stop_id: "PULI", stop_name: "Pulinchodu" },
  { stop_id: "COMP", stop_name: "Companypady" },
  { stop_id: "AMBA", stop_name: "Ambattukavu" },
  { stop_id: "MUTT", stop_name: "Muttom" },
  { stop_id: "KALM", stop_name: "Kalamassery" },
  { stop_id: "COCH", stop_name: "Cochin University" },
  { stop_id: "PATH", stop_name: "Pathadipalam" },
  { stop_id: "EDAP", stop_name: "Edapally" },
  { stop_id: "CHAN", stop_name: "Changampuzha Park" },
  { stop_id: "JLNM", stop_name: "JLN Stadium" },
  { stop_id: "KALO", stop_name: "Kaloor" },
  { stop_id: "TOWN", stop_name: "Town Hall" },
  { stop_id: "MGRO", stop_name: "M.G. Road" },
  { stop_id: "MAHA", stop_name: "Maharaja's College" },
  { stop_id: "ERNS", stop_name: "Ernakulam South" },
  { stop_id: "KADA", stop_name: "Kadavanthra" },
  { stop_id: "ELAM", stop_name: "Elamkulam" },
  { stop_id: "VYTT", stop_name: "Vyttila" },
  { stop_id: "THAI", stop_name: "Thaikoodam" },
  { stop_id: "PETT", stop_name: "Petta" },
  { stop_id: "VADA", stop_name: "Vadakkekotta" },
  { stop_id: "SNJN", stop_name: "SN Junction" },
  { stop_id: "TRIP", stop_name: "Tripunithura" },
];

const routes = [
  {
    route_id: "R1",
    route_short_name: "Kochi Metro Line 1",
    route_long_name: "Aluva - Tripunithura",
    route_type: 1,
  },
];

const fares = {
  fare_attributes: [
    { fare_id: "F1", price: "20" },
    { fare_id: "F2", price: "30" },
    { fare_id: "F3", price: "40" },
    { fare_id: "F4", price: "50" },
    { fare_id: "F5", price: "60" },
  ],
  fare_rules: [
    { fare_id: "F1", origin_id: "ALVA", destination_id: "EDAP" },
    { fare_id: "F2", origin_id: "ALVA", destination_id: "VYTT" },
    { fare_id: "F3", origin_id: "ALVA", destination_id: "PETT" },
    { fare_id: "F4", origin_id: "ALVA", destination_id: "SNJN" },
    { fare_id: "F5", origin_id: "ALVA", destination_id: "TRIP" },
  ],
};

const shapes = [
  { shape_id: "R001_0", shape_pt_lat: 10.1076, shape_pt_lon: 76.3561, shape_pt_sequence: 1, shape_dist_traveled: 0 },
  { shape_id: "R001_0", shape_pt_lat: 10.1, shape_pt_lon: 76.36, shape_pt_sequence: 2, shape_dist_traveled: 1200 },
  { shape_id: "R001_0", shape_pt_lat: 10.09, shape_pt_lon: 76.365, shape_pt_sequence: 3, shape_dist_traveled: 2400 },
  { shape_id: "R001_0", shape_pt_lat: 9.9935, shape_pt_lon: 76.3018, shape_pt_sequence: 25, shape_dist_traveled: 28000 },
];

function timeToSeconds(timeStr) {
  const [h, m, s] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function secondsToTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function generateTripsAndStopTimes() {
  const trips = [];
  const stopTimes = [];
  const totalDistance = 28000; // Total route distance in meters
  const tripDurationSeconds = 46 * 60; // 46 minutes
  const frequencySeconds = 7 * 60; // 7 minutes between trips
  const startTimeWeekday = timeToSeconds("06:00:00"); // 6 AM
  const endTime = timeToSeconds("22:30:00"); // 10:30 PM
  let tripCounter = 1;

  // Weekday schedule (Mon-Sat)
  for (let startTime = startTimeWeekday; startTime + tripDurationSeconds <= endTime; startTime += frequencySeconds) {
    // Direction 0: Aluva → Tripunithura
    const tripIdForward = `T${tripCounter}`;
    trips.push({
      trip_id: tripIdForward,
      route_id: "R1",
      service_id: "WD", // Weekday service
      shape_id: "R001_0",
      direction_id: 0,
    });

    stops.forEach((stop, index) => {
      const stopTimeSeconds = startTime + (index * tripDurationSeconds) / (stops.length - 1);
      const stopTime = secondsToTime(stopTimeSeconds);
      const distance = (totalDistance / (stops.length - 1)) * index;
      stopTimes.push({
        trip_id: tripIdForward,
        stop_id: stop.stop_id,
        arrival_time: stopTime,
        departure_time: stopTime,
        stop_sequence: index + 1,
        shape_dist_traveled: Math.round(distance),
      });
    });

    // Direction 1: Tripunithura → Aluva
    const tripIdBackward = `T${tripCounter + 1}`;
    trips.push({
      trip_id: tripIdBackward,
      route_id: "R1",
      service_id: "WD",
      shape_id: "R001_0",
      direction_id: 1,
    });

    stops.slice().reverse().forEach((stop, index) => {
      const stopTimeSeconds = startTime + (index * tripDurationSeconds) / (stops.length - 1);
      const stopTime = secondsToTime(stopTimeSeconds);
      const distance = totalDistance - (totalDistance / (stops.length - 1)) * index;
      stopTimes.push({
        trip_id: tripIdBackward,
        stop_id: stop.stop_id,
        arrival_time: stopTime,
        departure_time: stopTime,
        stop_sequence: index + 1,
        shape_dist_traveled: Math.round(distance),
      });
    });

    tripCounter += 2;
  }

  return { trips, stopTimes };
}

const { trips, stopTimes } = generateTripsAndStopTimes();

const metroData = {
  stops,
  routes,
  trips,
  stop_times: stopTimes,
  fares,
  shapes,
};

fs.writeFileSync("genData.json", JSON.stringify(metroData, null, 2), "utf8");
console.log("genData.json generated successfully!");