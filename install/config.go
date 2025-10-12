package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"gopkg.in/yaml.v3"
)

// TraefikConfig represents the structure of the main Traefik configuration
type TraefikConfig struct {
	Experimental struct {
		Plugins struct {
			Badger struct {
				Version string `yaml:"version"`
			} `yaml:"badger"`
		} `yaml:"plugins"`
	} `yaml:"experimental"`
	CertificatesResolvers struct {
		LetsEncrypt struct {
			Acme struct {
				Email string `yaml:"email"`
			} `yaml:"acme"`
		} `yaml:"letsencrypt"`
	} `yaml:"certificatesResolvers"`
}

// DynamicConfig represents the structure of the dynamic configuration
type DynamicConfig struct {
	HTTP struct {
		Routers map[string]struct {
			Rule string `yaml:"rule"`
		} `yaml:"routers"`
	} `yaml:"http"`
}

// TraefikConfigValues holds the extracted configuration values
type TraefikConfigValues struct {
	DashboardDomain  string
	LetsEncryptEmail string
	BadgerVersion    string
}

// AppConfig represents the app section of the config.yml
type AppConfig struct {
	App struct {
		DashboardURL string `yaml:"dashboard_url"`
		LogLevel     string `yaml:"log_level"`
	} `yaml:"app"`
}

type AppConfigValues struct {
	DashboardURL string
	LogLevel     string
}

// ReadTraefikConfig reads and extracts values from Traefik configuration files
func ReadTraefikConfig(mainConfigPath string) (*TraefikConfigValues, error) {
	// Read main config file
	mainConfigData, err := os.ReadFile(mainConfigPath)
	if err != nil {
		return nil, fmt.Errorf("error reading main config file: %w", err)
	}

	var mainConfig TraefikConfig
	if err := yaml.Unmarshal(mainConfigData, &mainConfig); err != nil {
		return nil, fmt.Errorf("error parsing main config file: %w", err)
	}

	// Extract values
	values := &TraefikConfigValues{
		BadgerVersion:    mainConfig.Experimental.Plugins.Badger.Version,
		LetsEncryptEmail: mainConfig.CertificatesResolvers.LetsEncrypt.Acme.Email,
	}

	return values, nil
}

func ReadAppConfig(configPath string) (*AppConfigValues, error) {
	// Read config file
	configData, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("error reading config file: %w", err)
	}

	var appConfig AppConfig
	if err := yaml.Unmarshal(configData, &appConfig); err != nil {
		return nil, fmt.Errorf("error parsing config file: %w", err)
	}

	values := &AppConfigValues{
		DashboardURL: appConfig.App.DashboardURL,
		LogLevel:     appConfig.App.LogLevel,
	}

	return values, nil
}

// findPattern finds the start of a pattern in a string
func findPattern(s, pattern string) int {
	return bytes.Index([]byte(s), []byte(pattern))
}

func copyDockerService(sourceFile, destFile, serviceName string) error {
	// Read source file
	sourceData, err := os.ReadFile(sourceFile)
	if err != nil {
		return fmt.Errorf("error reading source file: %w", err)
	}

	// Read destination file
	destData, err := os.ReadFile(destFile)
	if err != nil {
		return fmt.Errorf("error reading destination file: %w", err)
	}

	// Parse source Docker Compose YAML
	var sourceCompose map[string]interface{}
	if err := yaml.Unmarshal(sourceData, &sourceCompose); err != nil {
		return fmt.Errorf("error parsing source Docker Compose file: %w", err)
	}

	// Parse destination Docker Compose YAML
	var destCompose map[string]interface{}
	if err := yaml.Unmarshal(destData, &destCompose); err != nil {
		return fmt.Errorf("error parsing destination Docker Compose file: %w", err)
	}

	// Get services section from source
	sourceServices, ok := sourceCompose["services"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("services section not found in source file or has invalid format")
	}

	// Get the specific service configuration
	serviceConfig, ok := sourceServices[serviceName]
	if !ok {
		return fmt.Errorf("service '%s' not found in source file", serviceName)
	}

	// Get or create services section in destination
	destServices, ok := destCompose["services"].(map[string]interface{})
	if !ok {
		// If services section doesn't exist, create it
		destServices = make(map[string]interface{})
		destCompose["services"] = destServices
	}

	// Update service in destination
	destServices[serviceName] = serviceConfig

	// Marshal updated destination YAML
	// Use yaml.v3 encoder to preserve formatting and comments
	// updatedData, err := yaml.Marshal(destCompose)
	updatedData, err := MarshalYAMLWithIndent(destCompose, 2)
	if err != nil {
		return fmt.Errorf("error marshaling updated Docker Compose file: %w", err)
	}

	// Write updated YAML back to destination file
	if err := os.WriteFile(destFile, updatedData, 0644); err != nil {
		return fmt.Errorf("error writing to destination file: %w", err)
	}

	return nil
}

func backupConfig() error {
	// Backup docker-compose.yml
	if _, err := os.Stat("docker-compose.yml"); err == nil {
		if err := copyFile("docker-compose.yml", "docker-compose.yml.backup"); err != nil {
			return fmt.Errorf("failed to backup docker-compose.yml: %v", err)
		}
	}

	// Backup config directory
	if _, err := os.Stat("config"); err == nil {
		cmd := exec.Command("tar", "-czvf", "config.tar.gz", "config")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to backup config directory: %v", err)
		}
	}

	return nil
}

func MarshalYAMLWithIndent(data interface{}, indent int) ([]byte, error) {
	buffer := new(bytes.Buffer)
	encoder := yaml.NewEncoder(buffer)
	encoder.SetIndent(indent)

	err := encoder.Encode(data)
	if err != nil {
		return nil, err
	}

	defer encoder.Close()
	return buffer.Bytes(), nil
}

func replaceInFile(filepath, oldStr, newStr string) error {
	// Read the file content
	content, err := os.ReadFile(filepath)
	if err != nil {
		return fmt.Errorf("error reading file: %v", err)
	}

	// Replace the string
	newContent := strings.Replace(string(content), oldStr, newStr, -1)

	// Write the modified content back to the file
	err = os.WriteFile(filepath, []byte(newContent), 0644)
	if err != nil {
		return fmt.Errorf("error writing file: %v", err)
	}

	return nil
}

func CheckAndAddTraefikLogVolume(composePath string) error {
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

	// Check volumes
	logVolume := "./config/traefik/logs:/var/log/traefik"
	var volumes []interface{}

	if existingVolumes, ok := traefik["volumes"].([]interface{}); ok {
		// Check if volume already exists
		for _, v := range existingVolumes {
			if v.(string) == logVolume {
				fmt.Println("Traefik log volume is already configured")
				return nil
			}
		}
		volumes = existingVolumes
	}

	// Add new volume
	volumes = append(volumes, logVolume)
	traefik["volumes"] = volumes

	// Write updated config back to file
	newData, err := MarshalYAMLWithIndent(compose, 2)
	if err != nil {
		return fmt.Errorf("error marshaling updated compose file: %w", err)
	}

	if err := os.WriteFile(composePath, newData, 0644); err != nil {
		return fmt.Errorf("error writing updated compose file: %w", err)
	}

	fmt.Println("Added traefik log volume and created logs directory")
	return nil
}

// MergeYAML merges two YAML files, where the contents of the second file
// are merged into the first file. In case of conflicts, values from the
// second file take precedence.
func MergeYAML(baseFile, overlayFile string) error {
	// Read the base YAML file
	baseContent, err := os.ReadFile(baseFile)
	if err != nil {
		return fmt.Errorf("error reading base file: %v", err)
	}

	// Read the overlay YAML file
	overlayContent, err := os.ReadFile(overlayFile)
	if err != nil {
		return fmt.Errorf("error reading overlay file: %v", err)
	}

	// Parse base YAML into a map
	var baseMap map[string]interface{}
	if err := yaml.Unmarshal(baseContent, &baseMap); err != nil {
		return fmt.Errorf("error parsing base YAML: %v", err)
	}

	// Parse overlay YAML into a map
	var overlayMap map[string]interface{}
	if err := yaml.Unmarshal(overlayContent, &overlayMap); err != nil {
		return fmt.Errorf("error parsing overlay YAML: %v", err)
	}

	// Merge the overlay into the base
	merged := mergeMap(baseMap, overlayMap)

	// Marshal the merged result back to YAML
	mergedContent, err := MarshalYAMLWithIndent(merged, 2)
	if err != nil {
		return fmt.Errorf("error marshaling merged YAML: %v", err)
	}

	// Write the merged content back to the base file
	if err := os.WriteFile(baseFile, mergedContent, 0644); err != nil {
		return fmt.Errorf("error writing merged YAML: %v", err)
	}

	return nil
}

// mergeMap recursively merges two maps
func mergeMap(base, overlay map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// Copy all key-values from base map
	for k, v := range base {
		result[k] = v
	}

	// Merge overlay values
	for k, v := range overlay {
		// If both maps have the same key and both values are maps, merge recursively
		if baseVal, ok := base[k]; ok {
			if baseMap, isBaseMap := baseVal.(map[string]interface{}); isBaseMap {
				if overlayMap, isOverlayMap := v.(map[string]interface{}); isOverlayMap {
					result[k] = mergeMap(baseMap, overlayMap)
					continue
				}
			}
		}
		// Otherwise, overlay value takes precedence
		result[k] = v
	}

	return result
}
