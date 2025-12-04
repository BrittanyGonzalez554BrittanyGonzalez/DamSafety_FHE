// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DamSafetyMonitor is SepoliaConfig {
    // Sensor data structure
    struct EncryptedSensorData {
        euint32 encryptedSeepage;    // Encrypted seepage measurement
        euint32 encryptedDeformation; // Encrypted deformation measurement
        euint32 encryptedPressure;    // Encrypted water pressure
        uint256 timestamp;            // Measurement time
    }
    
    // Risk assessment results
    struct RiskAssessment {
        euint32 encryptedRiskScore;   // Encrypted risk score
        ebool encryptedWarningFlag;   // Encrypted warning flag
        bool isAssessed;              // Assessment status
    }
    
    // Contract state
    mapping(uint256 => EncryptedSensorData) public sensorData;
    mapping(uint256 => RiskAssessment) public riskAssessments;
    uint256 public dataCount;
    
    // Safety thresholds (encrypted)
    euint32 private encryptedSeepageThreshold;
    euint32 private encryptedDeformationThreshold;
    
    // Maintenance records
    struct MaintenanceRecord {
        uint256 timestamp;
        string action;
    }
    mapping(uint256 => MaintenanceRecord[]) public maintenanceHistory;
    
    // Events
    event SensorDataReceived(uint256 indexed dataId, uint256 timestamp);
    event RiskAssessmentRequested(uint256 indexed dataId);
    event RiskWarningGenerated(uint256 indexed dataId);
    event MaintenanceRecorded(uint256 indexed damId, string action);
    
    // Only authorized operators
    modifier onlyOperator() {
        // In real implementation: require(operators[msg.sender], "Unauthorized");
        _;
    }
    
    constructor() {
        // Initialize safety thresholds (values should be set securely in production)
        encryptedSeepageThreshold = FHE.asEuint32(500); // Example threshold
        encryptedDeformationThreshold = FHE.asEuint32(100); // Example threshold
    }
    
    /// @notice Submit encrypted sensor data
    function submitSensorData(
        euint32 seepage,
        euint32 deformation,
        euint32 pressure
    ) public onlyOperator {
        uint256 newId = ++dataCount;
        
        sensorData[newId] = EncryptedSensorData({
            encryptedSeepage: seepage,
            encryptedDeformation: deformation,
            encryptedPressure: pressure,
            timestamp: block.timestamp
        });
        
        // Initialize risk assessment
        riskAssessments[newId] = RiskAssessment({
            encryptedRiskScore: FHE.asEuint32(0),
            encryptedWarningFlag: FHE.asEbool(false),
            isAssessed: false
        });
        
        emit SensorDataReceived(newId, block.timestamp);
    }
    
    /// @notice Request risk assessment for sensor data
    function requestRiskAssessment(uint256 dataId) public onlyOperator {
        require(!riskAssessments[dataId].isAssessed, "Already assessed");
        
        // Prepare encrypted data for assessment
        bytes32[] memory ciphertexts = new bytes32[](5);
        EncryptedSensorData storage data = sensorData[dataId];
        
        ciphertexts[0] = FHE.toBytes32(data.encryptedSeepage);
        ciphertexts[1] = FHE.toBytes32(data.encryptedDeformation);
        ciphertexts[2] = FHE.toBytes32(data.encryptedPressure);
        ciphertexts[3] = FHE.toBytes32(encryptedSeepageThreshold);
        ciphertexts[4] = FHE.toBytes32(encryptedDeformationThreshold);
        
        // Request assessment
        uint256 reqId = FHE.requestComputation(ciphertexts, this.assessRisk.selector);
        
        emit RiskAssessmentRequested(dataId);
    }
    
    /// @notice Callback for risk assessment results
    function assessRisk(
        uint256 requestId,
        bytes memory results,
        bytes memory proof
    ) public {
        // Verify computation proof
        FHE.checkSignatures(requestId, results, proof);
        
        // Process assessment results
        uint32 riskScore;
        bool warningFlag;
        (riskScore, warningFlag) = abi.decode(results, (uint32, bool));
        
        riskAssessments[requestId] = RiskAssessment({
            encryptedRiskScore: FHE.asEuint32(riskScore),
            encryptedWarningFlag: FHE.asEbool(warningFlag),
            isAssessed: true
        });
        
        if (warningFlag) {
            emit RiskWarningGenerated(requestId);
        }
    }
    
    /// @notice Record maintenance action
    function recordMaintenance(uint256 damId, string memory action) public onlyOperator {
        maintenanceHistory[damId].push(MaintenanceRecord({
            timestamp: block.timestamp,
            action: action
        }));
        
        emit MaintenanceRecorded(damId, action);
    }
    
    /// @notice Update safety thresholds (encrypted)
    function updateSafetyThresholds(
        euint32 newSeepageThreshold,
        euint32 newDeformationThreshold
    ) public onlyOperator {
        encryptedSeepageThreshold = newSeepageThreshold;
        encryptedDeformationThreshold = newDeformationThreshold;
    }
    
    /// @notice Get current risk score (encrypted)
    function getEncryptedRiskScore(uint256 dataId) public view returns (euint32) {
        require(riskAssessments[dataId].isAssessed, "Not assessed");
        return riskAssessments[dataId].encryptedRiskScore;
    }
    
    /// @notice Check if warning was issued
    function hasWarning(uint256 dataId) public view returns (bool) {
        require(riskAssessments[dataId].isAssessed, "Not assessed");
        return FHE.decrypt(riskAssessments[dataId].encryptedWarningFlag);
    }
    
    /// @notice Get maintenance history
    function getMaintenanceHistory(uint256 damId) public view returns (MaintenanceRecord[] memory) {
        return maintenanceHistory[damId];
    }
}