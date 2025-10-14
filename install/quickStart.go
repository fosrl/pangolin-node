package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	FRONTEND_SECRET_KEY = "af4e4785-7e09-11f0-b93a-74563c4e2a7e"
	// CLOUD_API_URL       = "https://pangolin.fossorial.io/api/v1/remote-exit-node/quick-start"
	CLOUD_API_URL = "https://pangolin.fossorial.io/api/v1/remote-exit-node/quick-start"
)

// HybridCredentials represents the response from the cloud API
type HybridCredentials struct {
	RemoteExitNodeId string `json:"remoteExitNodeId"`
	Secret           string `json:"secret"`
}

// APIResponse represents the full response structure from the cloud API
type APIResponse struct {
	Data HybridCredentials `json:"data"`
}

// RequestPayload represents the request body structure
type RequestPayload struct {
	Token string `json:"token"`
}

func generateValidationToken() string {
	timestamp := time.Now().UnixMilli()
	data := fmt.Sprintf("%s|%d", FRONTEND_SECRET_KEY, timestamp)
	obfuscated := make([]byte, len(data))
	for i, char := range []byte(data) {
		obfuscated[i] = char + 5
	}
	return base64.StdEncoding.EncodeToString(obfuscated)
}

// requestHybridCredentials makes an HTTP POST request to the cloud API
// to get hybrid credentials (ID and secret)
func requestHybridCredentials() (*HybridCredentials, error) {
	// Generate validation token
	token := generateValidationToken()

	// Create request payload
	payload := RequestPayload{
		Token: token,
	}

	// Marshal payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request payload: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", CLOUD_API_URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", "x-csrf-protection")

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Make the request
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %v", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status code: %d", resp.StatusCode)
	}

	// Read response body for debugging
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	// Print the raw JSON response for debugging
	// fmt.Printf("Raw JSON response: %s\n", string(body))

	// Parse response
	var apiResponse APIResponse
	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode API response: %v", err)
	}

	// Validate response data
	if apiResponse.Data.RemoteExitNodeId == "" || apiResponse.Data.Secret == "" {
		return nil, fmt.Errorf("invalid response: missing remoteExitNodeId or secret")
	}

	return &apiResponse.Data, nil
}
