# Scrum Board

A Jira-like Scrum Dashboard built with Spring Boot, Java 11, and MySQL.

## Features
- **Visual Expiry Timeline**: Display ticket deadlines with flags on a +/- 30 day timeline.
- **Dynamic Filtering**: Filter tickets by Tags and Assignees.
- **Sub-task Management**: Support for hierarchical tickets (主任務與子任務).
- **Premium UI**: Modern minimalist design with smooth animations and responsive layout.

---

## Database Setup

To run this project, you need to set up a MySQL database.

### 1. Create Database
```sql
CREATE DATABASE IF NOT EXISTS scrum_board;
USE scrum_board;
```

### 2. Create `ticket` Table
```sql
CREATE TABLE IF NOT EXISTS `ticket` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `ticket_identifier` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text,
  `status` varchar(255) DEFAULT NULL,
  `position` int(11) DEFAULT NULL,
  `assignee` varchar(255) DEFAULT NULL,
  `creator` varchar(255) DEFAULT NULL,
  `tag` varchar(255) DEFAULT NULL,
  `expired_date` datetime(6) DEFAULT NULL,
  `parent_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_parent_ticket` (`parent_id`),
  CONSTRAINT `FK_parent_ticket` FOREIGN KEY (`parent_id`) REFERENCES `ticket` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3. Create User (Optional)
This matches the default `application.yml` configuration:
```sql
CREATE USER IF NOT EXISTS 'springboot'@'localhost' IDENTIFIED BY 'springboot';
GRANT ALL PRIVILEGES ON scrum_board.* TO 'springboot'@'localhost';
FLUSH PRIVILEGES;
```

---

## Getting Started

### Prerequisites
- JDK 11
- Maven
- MySQL

### How to Run
1. Configure your database connection in `src/main/resources/application.yml`.
2. Run the application:
   ```bash
   ./mvnw spring-boot:run
   ```
3. Access the dashboard at `http://localhost:8080`.
