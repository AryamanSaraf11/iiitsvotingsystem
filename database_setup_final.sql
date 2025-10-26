-- ====================================================================
-- IIITS STUDENT VOTING SYSTEM - FINAL DATABASE WITH BLOCKCHAIN
-- This single script creates the database, all tables, and inserts all
-- necessary data, including the blockchain genesis records.
-- Version: 1.0
-- ====================================================================

-- Create the database if it doesn't exist to make the script self-contained
CREATE DATABASE IF NOT EXISTS student_voting_system;
USE student_voting_system;

-- Drop tables in reverse order of dependency to ensure a clean slate
DROP TABLE IF EXISTS `votes`;
DROP TABLE IF EXISTS `audit_log`;
DROP TABLE IF EXISTS `candidates`;
DROP TABLE IF EXISTS `admins`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `election_settings`;

-- ==========================================
-- CREATE TABLES
-- ==========================================

CREATE TABLE `students` (
  `student_id` varchar(50) NOT NULL PRIMARY KEY,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL UNIQUE,
  `password_hash` varchar(255) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `year_of_study` int(11) DEFAULT NULL,
  `has_voted` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
);

CREATE TABLE `admins` (
  `admin_id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` varchar(50) NOT NULL UNIQUE,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL UNIQUE,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL
);

CREATE TABLE `candidates` (
  `candidate_id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `student_id` varchar(50) NOT NULL UNIQUE,
  `full_name` varchar(100) NOT NULL,
  `tagline` text DEFAULT NULL,
  `manifesto` text DEFAULT NULL,
  `photo_url` varchar(255) DEFAULT NULL,
  `vote_count` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
);

CREATE TABLE `votes` (
  `vote_id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `student_id` varchar(50) NOT NULL UNIQUE,
  `candidate_id` int(11) NOT NULL,
  `voted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(45) DEFAULT NULL,
  `vote_hash` varchar(256) DEFAULT NULL,
  `previous_hash` varchar(256) DEFAULT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`candidate_id`) ON DELETE CASCADE
);

CREATE TABLE `election_settings` (
  `setting_id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `election_name` varchar(200) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_paused` tinyint(1) DEFAULT 0,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `results_published` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
);

CREATE TABLE `audit_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` varchar(50) DEFAULT NULL,
  `user_type` enum('student','admin') NOT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
);

-- ==========================================
-- INSERT DATA
-- ==========================================

-- Disable safety features to insert system records with ID 0
SET FOREIGN_KEY_CHECKS=0;
SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

-- Insert 'SYSTEM' records required for the blockchain genesis block
INSERT INTO `students` (`student_id`, `full_name`, `email`, `password_hash`) VALUES
('SYSTEM', 'System Genesis', 'system@internal.local', 'none');

INSERT INTO `candidates` (`candidate_id`, `student_id`, `full_name`, `tagline`, `manifesto`) VALUES
(0, 'SYSTEM', 'System Genesis Candidate', 'N/A', 'N/A');

INSERT INTO `votes` (`vote_id`, `student_id`, `candidate_id`, `ip_address`, `vote_hash`, `previous_hash`) VALUES
(0, 'SYSTEM', 0, '0.0.0.0', '0000000000000000000000000000000000000000000000000000000000000000', '0');

-- Re-enable safety features
SET FOREIGN_KEY_CHECKS=1;
SET SESSION sql_mode = '';

-- Insert Students (All passwords are 'abc123')
INSERT INTO `students` (`student_id`, `full_name`, `email`, `password_hash`, `department`, `year_of_study`) VALUES
('S001', 'Aryaman Saraf', 'aryaman.s25@iiits.in', 'abc123', 'Computer Science', 2),
('S002', 'Suryansh Bakshi', 'suryansh.b25@iiits.in', 'abc123', 'Computer Science', 2),
('S003', 'Raniel Babu Chinta', 'babuchinta.r25@iiits.in', 'abc123', 'Computer Science', 2),
('S004', 'Hetanshu Agarwal', 'hetanshu.a25@iiits.in', 'abc123', 'Computer Science', 2),
('S005', 'Aditya Sharma', 'aditya.s25@iiits.in', 'abc123', 'Electronics', 2),
('S006', 'Priya Patel', 'priya.p25@iiits.in', 'abc123', 'Computer Science', 2),
('S007', 'Rahul Kumar', 'rahul.k25@iiits.in', 'abc123', 'Mechanical', 2),
('S008', 'Sneha Reddy', 'sneha.r25@iiits.in', 'abc123', 'Electronics', 2),
('S009', 'Arjun Mehta', 'arjun.m25@iiits.in', 'abc123', 'Computer Science', 2),
('S010', 'Kavya Iyer', 'kavya.i25@iiits.in', 'abc123', 'Computer Science', 2),
('S011', 'Rohan Gupta', 'rohan.g25@iiits.in', 'abc123', 'Electronics', 2),
('S012', 'Ananya Singh', 'ananya.s25@iiits.in', 'abc123', 'Mechanical', 2),
('S013', 'Karthik Nair', 'karthik.n25@iiits.in', 'abc123', 'Computer Science', 2),
('S014', 'Ishita Verma', 'ishita.v25@iiits.in', 'abc123', 'Electronics', 2),
('S015', 'Vivek Joshi', 'vivek.j25@iiits.in', 'abc123', 'Computer Science', 2),
('S016', 'Tanvi Desai', 'tanvi.d25@iiits.in', 'abc123', 'Mechanical', 2),
('S017', 'Siddharth Rao', 'siddharth.r25@iiits.in', 'abc123', 'Electronics', 2),
('S018', 'Meera Chopra', 'meera.c25@iiits.in', 'abc123', 'Computer Science', 2),
('S019', 'Nikhil Bansal', 'nikhil.b25@iiits.in', 'abc123', 'Computer Science', 2),
('S020', 'Riya Malhotra', 'riya.m25@iiits.in', 'abc123', 'Electronics', 2);

-- Insert Admins (All passwords are 'admin_abc123')
INSERT INTO `admins` (`username`, `password_hash`, `full_name`, `email`) VALUES
('aryaman_admin', 'admin_abc123', 'Aryaman Saraf', 'aryaman.s25@iiits.in'),
('suryansh_admin', 'admin_abc123', 'Suryansh Bakshi', 'suryansh.b25@iiits.in'),
('raniel_admin', 'admin_abc123', 'Raniel Babu Chinta', 'babuchinta.r25@iiits.in');

-- Insert Candidates
INSERT INTO `candidates` (`student_id`, `full_name`, `tagline`, `manifesto`) VALUES
('S001', 'Aryaman Saraf', 'Innovation and Technology for IIITS', 'I will work towards bringing cutting-edge technology to our campus.'),
('S002', 'Suryansh Bakshi', 'Student Welfare and Campus Development', 'My focus is on improving student amenities and a transparent student council.'),
('S003', 'Raniel Babu Chinta', 'Academic Excellence and Career Growth', 'I will prioritize academic support programs and placement preparation.');

-- Insert Election Settings
INSERT INTO `election_settings` (`election_name`, `is_active`, `is_paused`, `start_date`, `end_date`) VALUES
('IIITS Student Council Election 2025', 1, 0, '2025-01-01 00:00:00', '2025-12-31 23:59:59');