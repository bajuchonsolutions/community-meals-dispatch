import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import KeplerGl from 'kepler.gl';
import { addDataToKeplerGl } from 'kepler.gl/actions';
import Processors from 'kepler.gl/processors';
import PODDrillDown from '../components/PODDrillDown'; // 1. Import the panel

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const [activeMeal, setActiveMeal] = useState(null); // 2. Add state for the selected meal

  useEffect(() => {
    // Fetch the aggregated logistics pulse from your Go-lang backend
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
            visState: {
              layers: [
                {
                  id: 'delivery-heat',
                  type: 'heatmap',
                  config: {
                    dataId: 'logistics_pulse',
                    label: 'Vendor Output Density',
                    colorRange: {
                      colors: ['#121212', '#008080', '#FF9900'] 
                    }
                  }
                }
              ]
            }
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
      
      {/* 3. Render the drill-down panel when an admin clicks a map point */}
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
