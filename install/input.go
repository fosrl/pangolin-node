package main

import (
	"bufio"
	"fmt"
	"strings"
	"syscall"

	"golang.org/x/term"
)

func readString(reader *bufio.Reader, prompt string, defaultValue string) string {
	if defaultValue != "" {
		fmt.Printf("%s (default: %s): ", prompt, defaultValue)
	} else {
		fmt.Print(prompt + ": ")
	}
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)
	if input == "" {
		return defaultValue
	}
	return input
}

func readStringNoDefault(reader *bufio.Reader, prompt string) string {
	fmt.Print(prompt + ": ")
	input, _ := reader.ReadString('\n')
	return strings.TrimSpace(input)
}

func readPassword(prompt string, reader *bufio.Reader) string {
	if term.IsTerminal(int(syscall.Stdin)) {
		fmt.Print(prompt + ": ")
		// Read password without echo if we're in a terminal
		password, err := term.ReadPassword(int(syscall.Stdin))
		fmt.Println() // Add a newline since ReadPassword doesn't add one
		if err != nil {
			return ""
		}
		input := strings.TrimSpace(string(password))
		if input == "" {
			return readPassword(prompt, reader)
		}
		return input
	} else {
		// Fallback to reading from stdin if not in a terminal
		return readString(reader, prompt, "")
	}
}

func readBool(reader *bufio.Reader, prompt string, defaultValue bool) bool {
	defaultStr := "no"
	if defaultValue {
		defaultStr = "yes"
	}
	input := readString(reader, prompt+" (yes/no)", defaultStr)
	return strings.ToLower(input) == "yes"
}

func readBoolNoDefault(reader *bufio.Reader, prompt string) bool {
	input := readStringNoDefault(reader, prompt+" (yes/no)")
	return strings.ToLower(input) == "yes"
}

func readInt(reader *bufio.Reader, prompt string, defaultValue int) int {
	input := readString(reader, prompt, fmt.Sprintf("%d", defaultValue))
	if input == "" {
		return defaultValue
	}
	value := defaultValue
	fmt.Sscanf(input, "%d", &value)
	return value
}
