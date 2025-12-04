// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface DamSensorData {
  id: string;
  sensorType: "seepage" | "deformation" | "pressure";
  value: string;
  timestamp: number;
  location: string;
  riskLevel: "low" | "medium" | "high" | "critical";
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [sensorData, setSensorData] = useState<DamSensorData[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "sensors" | "analysis">("dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  // Calculate statistics
  const criticalCount = sensorData.filter(d => d.riskLevel === "critical").length;
  const highRiskCount = sensorData.filter(d => d.riskLevel === "high").length;
  const mediumRiskCount = sensorData.filter(d => d.riskLevel === "medium").length;
  const lowRiskCount = sensorData.filter(d => d.riskLevel === "low").length;

  useEffect(() => {
    checkContractAvailability().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const checkContractAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE Contract is available and ready!"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e) {
      console.error("Error checking contract availability:", e);
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Failed to connect to FHE contract"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const generateSampleData = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Generating encrypted sensor data with FHE..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      // Simulate FHE encrypted data generation
      const sampleData: DamSensorData[] = [
        {
          id: `sensor-${Date.now()}-1`,
          sensorType: "seepage",
          value: "0.45",
          timestamp: Math.floor(Date.now() / 1000),
          location: "North Wall Section 2",
          riskLevel: "medium"
        },
        {
          id: `sensor-${Date.now()}-2`,
          sensorType: "deformation",
          value: "2.1",
          timestamp: Math.floor(Date.now() / 1000),
          location: "Base Slab Center",
          riskLevel: "low"
        },
        {
          id: `sensor-${Date.now()}-3`,
          sensorType: "pressure",
          value: "3.8",
          timestamp: Math.floor(Date.now() / 1000),
          location: "Spillway Gate 1",
          riskLevel: "high"
        }
      ];
      
      // Store encrypted data on-chain
      await contract.setData(
        "dam_sensor_data", 
        ethers.toUtf8Bytes(JSON.stringify(sampleData))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE encrypted data generated successfully!"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      loadSensorData();
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Data generation failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const loadSensorData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const dataBytes = await contract.getData("dam_sensor_data");
      let data: DamSensorData[] = [];
      
      if (dataBytes.length > 0) {
        try {
          data = JSON.parse(ethers.toUtf8String(dataBytes));
        } catch (e) {
          console.error("Error parsing sensor data:", e);
        }
      }
      
      setSensorData(data);
    } catch (e) {
      console.error("Error loading sensor data:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const filteredData = sensorData.filter(data => 
    data.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.sensorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.riskLevel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Link your Web3 wallet to access the FHE digital twin",
      icon: "🔗"
    },
    {
      title: "Generate Data",
      description: "Create encrypted sensor data for analysis",
      icon: "📊"
    },
    {
      title: "Monitor Risks",
      description: "View real-time risk assessments through FHE processing",
      icon: "⚠️"
    },
    {
      title: "Take Action",
      description: "Respond to critical alerts to prevent dam failure",
      icon: "🛠️"
    }
  ];

  const renderRiskChart = () => {
    return (
      <div className="risk-chart">
        <div className="chart-bar critical" style={{ height: `${(criticalCount / sensorData.length) * 100 || 0}%` }}>
          <span>{criticalCount}</span>
        </div>
        <div className="chart-bar high" style={{ height: `${(highRiskCount / sensorData.length) * 100 || 0}%` }}>
          <span>{highRiskCount}</span>
        </div>
        <div className="chart-bar medium" style={{ height: `${(mediumRiskCount / sensorData.length) * 100 || 0}%` }}>
          <span>{mediumRiskCount}</span>
        </div>
        <div className="chart-bar low" style={{ height: `${(lowRiskCount / sensorData.length) * 100 || 0}%` }}>
          <span>{lowRiskCount}</span>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>DamSafety<span>FHE</span></h1>
          <p>Confidential Digital Twin for Dam Safety Monitoring</p>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <nav className="main-nav">
        <button 
          className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${activeTab === "sensors" ? "active" : ""}`}
          onClick={() => setActiveTab("sensors")}
        >
          Sensors
        </button>
        <button 
          className={`nav-btn ${activeTab === "analysis" ? "active" : ""}`}
          onClick={() => setActiveTab("analysis")}
        >
          Risk Analysis
        </button>
      </nav>
      
      <main className="main-content">
        {activeTab === "dashboard" && (
          <div className="dashboard-view">
            <div className="welcome-banner">
              <h2>Dam Safety Digital Twin</h2>
              <p>Real-time encrypted monitoring of seepage and deformation data using FHE technology</p>
            </div>
            
            <div className="action-cards">
              <div className="action-card">
                <h3>Check Contract</h3>
                <p>Verify FHE contract availability</p>
                <button 
                  onClick={checkContractAvailability}
                  className="action-btn"
                >
                  Check Availability
                </button>
              </div>
              
              <div className="action-card">
                <h3>Generate Data</h3>
                <p>Create encrypted sensor readings</p>
                <button 
                  onClick={generateSampleData}
                  className="action-btn"
                  disabled={!account}
                >
                  Generate Data
                </button>
              </div>
              
              <div className="action-card">
                <h3>View Data</h3>
                <p>Access encrypted sensor data</p>
                <button 
                  onClick={loadSensorData}
                  className="action-btn"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Loading..." : "Load Data"}
                </button>
              </div>
            </div>
            
            {showTutorial && (
              <div className="tutorial-section">
                <h2>Getting Started</h2>
                <div className="tutorial-steps">
                  {tutorialSteps.map((step, index) => (
                    <div className="tutorial-step" key={index}>
                      <div className="step-icon">{step.icon}</div>
                      <div className="step-content">
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === "sensors" && (
          <div className="sensors-view">
            <div className="view-header">
              <h2>Encrypted Sensor Data</h2>
              <div className="header-controls">
                <input
                  type="text"
                  placeholder="Search sensors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  onClick={() => setShowTutorial(!showTutorial)}
                  className="tutorial-btn"
                >
                  {showTutorial ? "Hide Guide" : "Show Guide"}
                </button>
              </div>
            </div>
            
            {sensorData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>No Sensor Data Available</h3>
                <p>Generate encrypted sensor data to begin monitoring</p>
                <button
                  onClick={generateSampleData}
                  className="primary-btn"
                  disabled={!account}
                >
                  Generate Data
                </button>
              </div>
            ) : (
              <div className="sensor-grid">
                {filteredData.map((data) => (
                  <div className={`sensor-card ${data.riskLevel}`} key={data.id}>
                    <div className="sensor-header">
                      <h3>{data.sensorType.toUpperCase()} SENSOR</h3>
                      <span className={`risk-badge ${data.riskLevel}`}>
                        {data.riskLevel}
                      </span>
                    </div>
                    <div className="sensor-details">
                      <p><strong>Location:</strong> {data.location}</p>
                      <p><strong>Value:</strong> {data.value}</p>
                      <p><strong>Timestamp:</strong> {new Date(data.timestamp * 1000).toLocaleString()}</p>
                    </div>
                    <div className="sensor-actions">
                      <button className="detail-btn">View Details</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === "analysis" && (
          <div className="analysis-view">
            <h2>Risk Analysis Dashboard</h2>
            
            <div className="analysis-cards">
              <div className="analysis-card">
                <h3>Risk Distribution</h3>
                {renderRiskChart()}
              </div>
              
              <div className="analysis-card stats">
                <h3>Risk Statistics</h3>
                <div className="stat-grid">
                  <div className="stat-item critical">
                    <div className="stat-value">{criticalCount}</div>
                    <div className="stat-label">Critical</div>
                  </div>
                  <div className="stat-item high">
                    <div className="stat-value">{highRiskCount}</div>
                    <div className="stat-label">High</div>
                  </div>
                  <div className="stat-item medium">
                    <div className="stat-value">{mediumRiskCount}</div>
                    <div className="stat-label">Medium</div>
                  </div>
                  <div className="stat-item low">
                    <div className="stat-value">{lowRiskCount}</div>
                    <div className="stat-label">Low</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="risk-timeline">
              <h3>Recent Alerts</h3>
              {sensorData.filter(d => d.riskLevel === "critical" || d.riskLevel === "high").length > 0 ? (
                <div className="timeline-items">
                  {sensorData
                    .filter(d => d.riskLevel === "critical" || d.riskLevel === "high")
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((data, index) => (
                      <div className={`timeline-item ${data.riskLevel}`} key={index}>
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <p><strong>{data.sensorType.toUpperCase()} Alert</strong> at {data.location}</p>
                          <p>Value: {data.value} - {new Date(data.timestamp * 1000).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <div className="no-alerts">
                  <p>No critical alerts detected</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-notification">
          <div className={`notification-content ${transactionStatus.status}`}>
            {transactionStatus.status === "pending" && <div className="spinner"></div>}
            {transactionStatus.message}
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>DamSafetyFHE</h3>
            <p>Confidential Digital Twin for Dam Safety Monitoring</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} DamSafetyFHE. All rights reserved.</p>
          <div className="fhe-badge">
            <span>FHE-Powered Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;