import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import KeplerGl from 'kepler.gl';
import { addDataToKeplerGl } from 'kepler.gl/actions';
import Processors from 'kepler.gl/processors';
import PODDrillDown from '../components/PODDrillDown';

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const [activeMeal, setActiveMeal] = useState(null);

  // 1. Subscribe to Kepler.gl's internal interaction state
  // This triggers automatically whenever an admin clicks a map layer
  const clickedLayerData = useSelector((state) => state.keplerGl['communi-meal-map']?.visState?.clicked);

  // 2. React to the click by mapping the raw GeoJSON row to your component state
  useEffect(() => {
    if (clickedLayerData && clickedLayerData.object) {
      // .object contains the raw row array/object from your dataset
      const row = clickedLayerData.object;
      
      setActiveMeal({
        id: row.meal_id || 'M-UNKNOWN',
        podImageUrl: row.pod_url || null, // URL from AWS S3 / Object Storage
        deliveredAt: row.timestamp || 'Unknown time',
        hmacValid: row.signature_valid === 'true', 
        geoValid: row.gps_offset_meters < 50,
        addressAnonymized: row.household_anon || 'Masked Address',
        vendorName: row.vendor_name || 'Network Vendor',
        driverName: row.driver_name || 'Volunteer',
        gpsOffsetMeters: row.gps_offset_meters || 0,
        deviceInfo: row.device_id || 'Unknown Device'
      });
    }
  }, [clickedLayerData]);

  useEffect(() => {
    const fetchLogisticsPulse = async () => {
      const response = await fetch('/v1/analytics/spatial/delivery-pulse');
      const data = await response.json();
      const processedData = Processors.processGeojson(data);
      
      dispatch(
        addDataToKeplerGl({
          datasets: {
            info: { label: 'Live Delivery Pulse', id: 'logistics_pulse' },
            data: processedData
          },
          option: { centerMap: true, readOnly: false },
          config: {
            // Configuration for your heatmap and point layers
          }
        })
      );
    };

    fetchLogisticsPulse();
  }, [dispatch]);

  return (
    <div style={{ position: 'absolute', width: '100vw', height: '100vh', background: '#121212' }}>
      <KeplerGl
        id="communi-meal-map"
        mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
        width={window.innerWidth}
        height={window.innerHeight}
      />
      
      {/* Render the drill-down panel if a meal is clicked */}
      {activeMeal && (
        <PODDrillDown 
          activeMeal={activeMeal} 
          onClose={() => setActiveMeal(null)} 
        />
      )}
    </div>
  );
};

export default AdminDashboard;
