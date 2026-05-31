<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Travel Organizer - Angular Application

## Project Overview
A comprehensive travel organizing website built with Angular to track daily schedules, distances, times, locations, costs, booking confirmations (flights, hotels, airbnbs), and trip photos. This is a portfolio project intended for personal use with family/friends.

## Tech Stack
- **Framework**: Angular 18+
- **Language**: TypeScript
- **Styling**: Angular Material / Tailwind CSS
- **State Management**: RxJS/NgRx
- **Database**: Firebase Firestore (recommended for portfolio flexibility)
- **Storage**: Firebase Storage (for trip photos)
- **Build Tool**: Angular CLI

## Key Features to Implement
1. **Trip Management** - Create, view, edit, delete trips
2. **Daily Schedules** - Time-based itineraries with locations
3. **Cost Tracking** - Budget management, expense categorization
4. **Booking Management** - Store confirmations with documents
5. **Location Mapping** - Display locations with distances/routes
6. **Photo Gallery** - Upload, organize, and view trip photos
7. **Dashboard** - Overview of all trips and upcoming travel
8. **User Authentication** - Firebase Auth for multi-user support
9. **Responsive Design** - Mobile-friendly interface
10. **Export/Share** - Generate trip summaries

## Project Structure
```
src/
├── app/
│   ├── core/              # Singleton services, guards, interceptors
│   ├── shared/            # Shared components, pipes, directives
│   ├── modules/           # Feature modules
│   │   ├── trips/         # Trip management
│   │   ├── itinerary/     # Daily schedule/itinerary
│   │   ├── costs/         # Cost tracking
│   │   ├── bookings/      # Booking management
│   │   ├── gallery/       # Photo gallery
│   │   └── map/           # Location mapping
│   ├── models/            # TypeScript interfaces/types
│   └── app.component.ts
├── assets/
├── environments/
└── styles/
```

## Development Guidelines
- Use standalone components and lazy loading for feature modules
- Implement proper error handling and loading states
- Follow Angular style guide and best practices
- Use TypeScript strict mode
- Implement unit tests for services and components
- Keep components focused and use smart/dumb component pattern

## Portfolio Considerations
- Clean, maintainable code for reviewing
- Comprehensive README with setup instructions
- Document architectural decisions
- Include deployment instructions (suggest Firebase Hosting)
- Create demo credentials for reviewers
