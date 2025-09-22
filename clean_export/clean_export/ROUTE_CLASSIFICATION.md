# Route Classification Analysis - Step 1

## Overview
This document classifies all 163 routes in `server/routes.ts` by their access level and responsibility.

## Classification Categories

- **[ADMIN]**: Super administrator only routes
- **[HOSPITAL]**: Hospital admin only routes  
- **[PUBLIC]**: Regular users or open APIs

## Route Classification Results

### PUBLIC Routes (Authenticated Users)
```
// Authentication & Profile
app.put("/api/auth/profile", requireAuth)                    // User profile update
app.put("/api/auth/change-password", requireAuth)            // Change password
app.get("/api/auth/notification-settings", requireAuth)      // Get notification settings
app.put("/api/auth/notification-settings", requireAuth)      // Update notification settings
app.post("/api/auth/send-verification-email", requireAuth)   // Send verification email
app.post("/api/auth/verify-email")                          // Verify email (no auth needed)

// Image Generation & Processing
app.post("/api/image/transform", requireAuth)               // Transform images
app.get("/api/images", requireAuth)                         // Get user images
app.get("/api/image/recent", requireAuth)                   // Get recent images
app.post("/api/generate-image", requireAuth)                // Generate maternity photos
app.post("/api/generate-family", requireAuth)               // Generate family photos
app.post("/api/generate-stickers", requireAuth)             // Generate stickers
app.delete("/api/images/:id", requireAuth)                  // Delete user image

// User Settings & Preferences
app.get("/api/notification-settings", requireAuth)          // Get notification settings
app.put("/api/notification-settings", requireAuth)          // Update notification settings
app.get("/api/user-settings", requireAuth)                  // Get user settings
app.put("/api/user-settings", requireAuth)                  // Update user settings

// Pregnancy & Milestones
app.get("/api/pregnancy-profile")                           // Get pregnancy profile
app.post("/api/pregnancy-profile")                          // Update pregnancy profile
app.get("/api/milestones")                                  // Get milestones
app.get("/api/milestone-categories")                        // Get milestone categories
app.get("/api/milestones/available")                        // Get available milestones
app.get("/api/milestones/completed")                        // Get completed milestones
app.post("/api/milestones/:milestoneId/complete")           // Complete milestone
app.get("/api/milestones/stats")                            // Get milestone stats

// Chat & AI Features
app.post("/api/chat/message")                               // Send chat message
app.get("/api/chat/history")                                // Get chat history
app.post("/api/chat/save")                                  // Save chat
app.get("/api/chat/saved")                                  // Get saved chats
app.get("/api/chat/saved/:id")                              // Get specific saved chat
app.delete("/api/chat/saved/:id")                           // Delete saved chat

// Music Generation
app.post("/api/music/generate")                             // Generate music
app.get("/api/music")                                       // Get music list
app.post("/api/generate-music")                             // Generate AI music
app.get("/api/music-styles")                                // Get music styles
app.get("/api/music-durations")                             // Get music durations

// Gallery & Media
app.get("/api/gallery")                                     // Get gallery items
app.post("/api/gallery/favorite")                           // Toggle favorite
app.get("/api/media/download/:type/:id")                    // Download media
app.post("/api/media/share")                                // Share media

// Campaign Applications
app.post("/api/campaign-applications")                      // Apply to campaign
```

### PUBLIC Routes (Open Access)
```
// Public Information
app.get("/api/small-banners")                               // Get homepage banners
app.get("/api/menu")                                        // Get navigation menu
app.get("/api/hospitals")                                   // Get hospital list
app.get("/api/hospitals/:id")                               // Get hospital details
app.get("/api/campaigns")                                   // Get public campaigns
app.get("/api/campaigns/:slug")                             // Get campaign by slug
app.get("/api/service-categories")                          // Get service categories

// Public Testing
app.get("/api/public/test")                                 // Public test endpoint
app.post("/api/public/image-transform")                     // Public image transform
app.get("/api/test-replicate")                              // Test Replicate API

// Development & Utilities
app.get('/embed.js')                                        // Embed script
app.get('/dev-chat-export')                                 // Dev chat export
app.get('/dev-history')                                     // Dev history

// File Upload & Storage
app.post('/api/gcs-test')                                   // GCS upload test
app.use('/api/upload')                                      // Upload router
```

### ADMIN Routes (Super Administrator)
```
// Banner Management
app.post("/api/admin/create-small-banner")                  // Create small banner
app.put("/api/admin/small-banners/:id")                     // Update small banner
app.delete("/api/admin/small-banners/:id")                  // Delete small banner
app.post("/api/admin/banners")                              // Create main banner
app.put("/api/admin/banners/:id")                           // Update main banner
app.delete("/api/admin/banners/:id")                        // Delete main banner

// User Management
app.get("/api/admin/users")                                 // Get all users (duplicate route exists)
app.delete("/api/admin/users/:id")                          // Delete user (duplicate route exists)
app.put("/api/admin/users/:id")                             // Update user (duplicate route exists)
app.get("/api/admin/users", requireAdminOrSuperAdmin)       // Get users (proper auth)
app.patch("/admin/users/:id/role", requireAdminOrSuperAdmin) // Update user role

// Persona Management
app.get("/api/admin/personas")                              // Get personas
app.get("/api/admin/personas/:id")                          // Get persona by ID
app.post("/api/admin/personas")                             // Create persona
app.put("/api/admin/personas/:id")                          // Update persona
app.delete("/api/admin/personas/:id")                       // Delete persona
app.post("/api/admin/personas/batch")                       // Batch create personas

// Category Management
app.get("/api/admin/categories")                            // Get categories
app.get("/api/admin/categories/:id")                        // Get category by ID
app.post("/api/admin/categories")                           // Create category
app.put("/api/admin/categories/:id")                        // Update category
app.delete("/api/admin/categories/:id")                     // Delete category

// Concept Management
app.get("/api/admin/concepts")                              // Get concepts
app.get("/api/admin/concepts/:id")                          // Get concept by ID
app.post("/api/admin/concepts")                             // Create concept
app.put("/api/admin/concepts/:id")                          // Update concept
app.delete("/api/admin/concepts/:id")                       // Delete concept

// Concept Category Management
app.get("/api/admin/concept-categories")                    // Get concept categories
app.get("/api/admin/concept-categories/:id")                // Get concept category by ID
app.post("/api/admin/concept-categories")                   // Create concept category
app.put("/api/admin/concept-categories/:id")                // Update concept category
app.delete("/api/admin/concept-categories/:id")             // Delete concept category

// Milestone Management
app.get("/api/admin/milestones")                            // Get admin milestones
app.post("/api/admin/milestones")                           // Create milestone
app.put("/api/admin/milestones/:id")                        // Update milestone
app.delete("/api/admin/milestones/:id")                     // Delete milestone
app.get("/api/admin/milestone-categories")                  // Get milestone categories
app.post("/api/admin/milestone-categories")                 // Create milestone category
app.put("/api/admin/milestone-categories/:categoryId")      // Update milestone category
app.delete("/api/admin/milestone-categories/:categoryId")   // Delete milestone category

// Campaign Management
app.get("/api/admin/campaigns")                             // Get admin campaigns
app.post("/api/admin/campaigns")                            // Create campaign
app.patch("/api/admin/campaigns/:id")                       // Update campaign
app.delete("/api/admin/campaigns/:id")                      // Delete campaign
app.get("/api/admin/campaign-applications")                 // Get campaign applications

// Hospital Management
app.get("/api/admin/hospitals")                             // Get hospitals (duplicate)
app.post("/api/admin/hospitals")                            // Create hospital (duplicate)
app.put("/api/admin/hospitals/:id")                         // Update hospital (duplicate)
app.delete("/api/admin/hospitals/:id")                      // Delete hospital (duplicate)
app.get("/admin/hospitals", requireAdminOrSuperAdmin)       // Get hospitals (proper auth)
app.get("/admin/hospitals/:id", requireAdminOrSuperAdmin)   // Get hospital by ID
app.post("/admin/hospitals", requireAdminOrSuperAdmin)      // Create hospital
app.patch("/admin/hospitals/:id", requireAdminOrSuperAdmin) // Update hospital
app.delete("/admin/hospitals/:id", requireAdminOrSuperAdmin) // Delete hospital

// Service Management
app.post("/api/admin/service-categories")                   // Create service category
app.put("/api/admin/service-categories/:id")                // Update service category
app.delete("/api/admin/service-categories/:id")             // Delete service category

// Super Admin Features
app.get("/api/super/hospitals")                             // Super admin hospital access

// File Upload
app.post("/api/admin/upload-thumbnail")                     // Upload thumbnail
```

### HOSPITAL Routes (Hospital Administrator)
```
// Hospital Campaign Management
app.get("/api/hospital/campaigns/:id", requireAuth)         // Get hospital campaign (mixed auth)
app.patch("/api/hospital/campaigns/:id")                    // Update hospital campaign
app.get("/api/hospital/campaigns")                          // Get hospital campaigns
app.get("/hospital/campaigns", requireHospitalAdmin)        // Get campaigns (proper auth)
app.get("/hospital/campaigns/:id", requireHospitalAdmin)    // Get campaign by ID
app.get("/hospital/campaign-applications", requireHospitalAdmin) // Get applications (duplicate)

// Hospital Application Management
app.get("/hospital/campaign-applications", requireHospitalAdmin) // Get campaign applications
app.patch("/hospital/campaign-applications/:id", requireHospitalAdmin) // Update application status

// Hospital Information
app.get("/api/hospital/info", requireHospitalAdmin)         // Get hospital info

// Hospital Reviews
app.get("/hospital/reviews", requireHospitalAdmin)          // Get hospital reviews
app.patch("/hospital/reviews/:id/select", requireHospitalAdmin) // Select review
```

## Issues Identified

### 1. Duplicate Routes
Several routes are defined multiple times with different authentication:
- `/api/admin/users` (lines 757, 6337)
- `/api/admin/hospitals` (lines 7483, 6797)
- `/hospital/campaign-applications` (lines 6138, 6550)

### 2. Missing Authentication
Some admin routes lack proper middleware:
- Most `/api/admin/*` routes don't use `requireAdminOrSuperAdmin`
- Some hospital routes don't use `requireHospitalAdmin`

### 3. Inconsistent Patterns
- Mix of `/api/admin/` and `/admin/` prefixes
- Inconsistent middleware usage
- Some routes have manual auth checks instead of middleware

## Recommendations for Splitting

1. **Create separate route files:**
   - `admin-routes.ts` - All [ADMIN] classified routes
   - `hospital-routes.ts` - All [HOSPITAL] classified routes  
   - `public-routes.ts` - All [PUBLIC] classified routes

2. **Fix authentication issues:**
   - Add proper middleware to all admin routes
   - Remove duplicate route definitions
   - Standardize route prefixes

3. **Implement consistent patterns:**
   - Use middleware instead of manual auth checks
   - Standardize error handling
   - Consistent response formats