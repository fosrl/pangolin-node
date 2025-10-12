package main

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"gopkg.in/yaml.v3"
)

func installCrowdsec(config Config) error {

	if err := stopContainers(config.InstallationContainerType); err != nil {
		return fmt.Errorf("failed to stop containers: %v", err)
	}

	// Run installation steps
	if err := backupConfig(); err != nil {
		return fmt.Errorf("backup failed: %v", err)
	}

	if err := createConfigFiles(config); err != nil {
		fmt.Printf("Error creating config files: %v\n", err)
		os.Exit(1)
	}

	os.MkdirAll("config/crowdsec/db", 0755)
	os.MkdirAll("config/crowdsec/acquis.d", 0755)
	os.MkdirAll("config/traefik/logs", 0755)

	if err := copyDockerService("config/crowdsec/docker-compose.yml", "docker-compose.yml", "crowdsec"); err != nil {
		fmt.Printf("Error copying docker service: %v\n", err)
		os.Exit(1)
	}

	if err := MergeYAML("config/traefik/traefik_config.yml", "config/crowdsec/traefik_config.yml"); err != nil {
		fmt.Printf("Error copying entry points: %v\n", err)
		os.Exit(1)
	}
	// delete the 2nd file
	if err := os.Remove("config/crowdsec/traefik_config.yml"); err != nil {
		fmt.Printf("Error removing file: %v\n", err)
		os.Exit(1)
	}

	if err := MergeYAML("config/traefik/dynamic_config.yml", "config/crowdsec/dynamic_config.yml"); err != nil {
		fmt.Printf("Error copying entry points: %v\n", err)
		os.Exit(1)
	}
	// delete the 2nd file
	if err := os.Remove("config/crowdsec/dynamic_config.yml"); err != nil {
		fmt.Printf("Error removing file: %v\n", err)
		os.Exit(1)
	}

	if err := os.Remove("config/crowdsec/docker-compose.yml"); err != nil {
		fmt.Printf("Error removing file: %v\n", err)
		os.Exit(1)
	}

	if err := CheckAndAddTraefikLogVolume("docker-compose.yml"); err != nil {
		fmt.Printf("Error checking and adding Traefik log volume: %v\n", err)
		os.Exit(1)
	}

	// check and add the service dependency of crowdsec to traefik
	if err := CheckAndAddCrowdsecDependency("docker-compose.yml"); err != nil {
		fmt.Printf("Error adding crowdsec dependency to traefik: %v\n", err)
		os.Exit(1)
	}

	if err := startContainers(config.InstallationContainerType); err != nil {
		return fmt.Errorf("failed to start containers: %v", err)
	}

	// get API key
	apiKey, err := GetCrowdSecAPIKey(config.InstallationContainerType)
	if err != nil {
		return fmt.Errorf("failed to get API key: %v", err)
	}
	config.TraefikBouncerKey = apiKey

	if err := replaceInFile("config/traefik/dynamic_config.yml", "PUT_YOUR_BOUNCER_KEY_HERE_OR_IT_WILL_NOT_WORK", config.TraefikBouncerKey); err != nil {
		return fmt.Errorf("failed to replace bouncer key: %v", err)
	}

	if err := restartContainer("traefik", config.InstallationContainerType); err != nil {
		return fmt.Errorf("failed to restart containers: %v", err)
	}

	if checkIfTextInFile("config/traefik/dynamic_config.yml", "PUT_YOUR_BOUNCER_KEY_HERE_OR_IT_WILL_NOT_WORK") {
		fmt.Println("Failed to replace bouncer key! Please retrieve the key and replace it in the config/traefik/dynamic_config.yml file using the following command:")
		fmt.Println("	docker exec crowdsec cscli bouncers add traefik-bouncer")
	}

	return nil
}

func checkIsCrowdsecInstalledInCompose() bool {
	// Read docker-compose.yml
	content, err := os.ReadFile("docker-compose.yml")
	if err != nil {
		return false
	}

	// Check for crowdsec service
	return bytes.Contains(content, []byte("crowdsec:"))
}

func GetCrowdSecAPIKey(containerType SupportedContainer) (string, error) {
	// First, ensure the container is running
	if err := waitForContainer("crowdsec", containerType); err != nil {
		return "", fmt.Errorf("waiting for container: %w", err)
	}

	// Execute the command to get the API key
	cmd := exec.Command("docker", "exec", "crowdsec", "cscli", "bouncers", "add", "traefik-bouncer", "-o", "raw")
	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("executing command: %w", err)
	}

	// Trim any whitespace from the output
	apiKey := strings.TrimSpace(out.String())
	if apiKey == "" {
		return "", fmt.Errorf("empty API key returned")
	}

	return apiKey, nil
}

func checkIfTextInFile(file, text string) bool {
	// Read file
	content, err := os.ReadFile(file)
	if err != nil {
		return false
	}

	// Check for text
	return bytes.Contains(content, []byte(text))
}

func CheckAndAddCrowdsecDependency(composePath string) error {
	// Read the docker-compose.yml file
	data, err := os.ReadFile(composePath)
	if err != nil {
		return fmt.Errorf("error reading compose file: %w", err)
	}

	// Parse YAML into a generic map
	var compose map[string]interface{}
	if err := yaml.Unmarshal(data, &compose); err != nil {
		return fmt.Errorf("error parsing compose file: %w", err)
	}

	// Get services section
	services, ok := compose["services"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("services section not found or invalid")
	}

	// Get traefik service
	traefik, ok := services["traefik"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("traefik service not found or invalid")
	}

	// Get dependencies
	dependsOn, ok := traefik["depends_on"].(map[string]interface{})
	if ok {
		// Append the new block for crowdsec
		dependsOn["crowdsec"] = map[string]interface{}{
			"condition": "service_healthy",
		}
	} else {
		// No dependencies exist, create it
		traefik["depends_on"] = map[string]interface{}{
			"crowdsec": map[string]interface{}{
				"condition": "service_healthy",
			},
		}
	}

	// Marshal the modified data back to YAML with indentation
	modifiedData, err := MarshalYAMLWithIndent(compose, 2) // Set indentation to 2 spaces
	if err != nil {
		log.Fatalf("error marshaling YAML: %v", err)
	}

	if err := os.WriteFile(composePath, modifiedData, 0644); err != nil {
		return fmt.Errorf("error writing updated compose file: %w", err)
	}

	fmt.Println("Added dependency of crowdsec to traefik")
	return nil
}
