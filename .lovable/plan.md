
The user wants end-to-end testing of the website. This is a verification task — I'll switch to default mode and use browser automation to test key flows: homepage (FAQ, Why Choose Us, social icons), navigation, Pricing, Booking with R600 minimum, Login tabs (Client/Tutor/Admin), Contact page (Google Maps, social cards), and mobile menu.

## Test Plan

1. **Homepage** — verify hero, stats (R600 starting price), Why Choose Us (7 features), FAQ accordion, footer social icons
2. **Navbar & Mobile menu** — test navigation links and hamburger menu at 360px viewport
3. **Pricing page** — confirm all packages show R600 minimum, no free services
4. **Booking flow** — select Research/Consultation package, confirm R600 minimum displayed, verify auth guard blocks unauthenticated submission
5. **Login page** — verify Client/Tutor/Admin tabs render and switch correctly
6. **Contact page** — verify Google Maps embed loads, social cards display, Rustenburg address shown
7. **Console check** — review for runtime errors (note: existing forwardRef warnings on Footer/WhatsAppButton are pre-existing non-blocking warnings)

I'll report findings with screenshots and flag any issues found.
