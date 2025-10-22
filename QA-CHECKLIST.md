# QuoteCat QA Checklist

## Pre-Tester QA Session
Date: 2025-10-22
Branch: integration/all-features

---

## 🎯 Critical Paths

### 1. Quote Creation Flow
- [ ] Dashboard → Quotes tab → + button
- [ ] Creates new blank quote
- [ ] Edit screen loads without errors
- [ ] Can enter project name
- [ ] Can enter client name
- [ ] Can set status
- [ ] Can toggle pin (star in header)
- [ ] "Review & Export" button works

### 2. Materials Flow
- [ ] From edit screen → "Add materials" button
- [ ] Materials picker loads
- [ ] Categories expand/collapse
- [ ] Can add items using + button
- [ ] Quantities update correctly
- [ ] "Add to quote" button works
- [ ] Returns to edit screen with items
- [ ] Items display in edit screen

### 3. Assembly Flow
- [ ] From materials screen → "Assemblies" button
- [ ] Assembly library loads (Pro users only)
- [ ] Can select an assembly
- [ ] Calculator shows parameters (if applicable)
- [ ] Can enter parameter values
- [ ] Materials calculate correctly
- [ ] "Create Quote" button works
- [ ] Alert shows with View Quote / Done options
- [ ] "View Quote" navigates to edit screen
- [ ] "Done" returns to previous screen

### 4. Quote Management
- [ ] Quotes list shows all quotes
- [ ] Can search quotes
- [ ] Can filter by status (All, Pinned, Draft, Sent, etc.)
- [ ] Swipe left shows Delete/Duplicate actions
- [ ] Swipe right shows Pin/Unpin action
- [ ] Delete shows undo snackbar
- [ ] Undo restores deleted quote
- [ ] Duplicate creates new quote
- [ ] Pin/Unpin updates immediately

### 5. Review & Export
- [ ] Review screen loads with all quote details
- [ ] Totals calculate correctly
- [ ] Labor shows with .00 format
- [ ] Markup calculates correctly
- [ ] Edit buttons work (client, items)
- [ ] "Generate PDF" button works
- [ ] PDF preview loads
- [ ] Can share/save PDF
- [ ] "Generate Spreadsheet" button works
- [ ] Spreadsheet exports successfully

---

## 🎨 UI/UX Checks

### Navigation
- [ ] All back buttons work
- [ ] Headers show on all screens
- [ ] Tab bar visible and functional
- [ ] No double safe area issues
- [ ] FAB button doesn't overlap tab bar

### Theming
- [ ] Light mode looks correct
- [ ] Dark mode looks correct
- [ ] All text readable in both modes
- [ ] Accent orange shows correctly
- [ ] Status badges colored correctly
- [ ] No hardcoded white/black issues

### Spacing & Layout
- [ ] Consistent padding throughout
- [ ] No cramped or overlapping elements
- [ ] Cards have proper spacing
- [ ] Form inputs properly aligned
- [ ] Buttons properly sized

### Loading States
- [ ] Dashboard shows loading spinner
- [ ] Assembly library shows loading
- [ ] Review screen shows loading
- [ ] No flash of empty content

### Empty States
- [ ] Dashboard shows empty state (no quotes)
- [ ] Quotes list shows empty state
- [ ] Assembly library shows empty state
- [ ] Materials picker handles no products

---

## 🔧 Pro Features

### Pro Tools Screen
- [ ] Shows upgrade teaser for free users
- [ ] Shows tools for Pro users
- [ ] Assembly Manager card works (Pro)
- [ ] Assembly Library card works (Pro)
- [ ] Coming Soon section displays correctly

### Assembly Library Access
- [ ] Free users see upgrade message
- [ ] Pro users can access library
- [ ] 8 seed assemblies present
- [ ] Can search assemblies
- [ ] Custom assemblies shown with 📌
- [ ] Long-press delete works (custom only)

### Assembly Manager
- [ ] Can create custom assemblies
- [ ] Can save quote as assembly
- [ ] Custom assemblies persist
- [ ] Can delete custom assemblies
- [ ] Cannot delete seed assemblies

---

## ⚙️ Settings

### General Settings
- [ ] Settings screen loads
- [ ] Theme toggle works (Light/Dark)
- [ ] Dashboard preferences save
- [ ] About section expands/collapses

### Debug Tools
- [ ] Debug section expands/collapses
- [ ] "Reset Assemblies" works
- [ ] "Reset Products" works
- [ ] Data syncs after reset

---

## 📱 Platform-Specific

### iOS
- [ ] Status picker chips work
- [ ] Swipe gestures smooth
- [ ] Haptic feedback (if implemented)
- [ ] Safe area respected

### Android
- [ ] Back button works throughout
- [ ] Material design looks correct
- [ ] No overflow issues

---

## 🐛 Known Issues & Edge Cases

### To Test
- [ ] Empty quote name (should show "Untitled")
- [ ] Very long quote names (truncation)
- [ ] Very long client names
- [ ] Quote with 0 items
- [ ] Quote with 50+ items
- [ ] Negative quantities (should prevent)
- [ ] $0.00 quotes
- [ ] Very large dollar amounts ($999,999+)
- [ ] Special characters in names (@#$%)
- [ ] Emoji in names (🏠🔨)

### Previously Fixed Bugs
- [ ] Assembly crash when accessed from materials picker (FIXED)
- [ ] White search border in assemblies (FIXED)
- [ ] Hardcoded success message color (FIXED)
- [ ] Missing loading state on dashboard (FIXED)
- [ ] Double back navigation crash (FIXED)

---

## 📊 Data Integrity

### Quote Storage
- [ ] Quotes persist after app restart
- [ ] Edited quotes save correctly
- [ ] Deleted quotes removed
- [ ] Duplicated quotes independent

### Materials & Assemblies
- [ ] Products load correctly
- [ ] Prices accurate
- [ ] Assemblies calculate correctly
- [ ] Custom assemblies persist

### Calculations
- [ ] Material totals correct
- [ ] Labor adds correctly
- [ ] Markup % applies correctly
- [ ] Grand total accurate
- [ ] Decimal precision correct (2 places)

---

## 🎯 Performance

### Load Times
- [ ] App starts quickly
- [ ] Dashboard loads fast
- [ ] Quotes list scrolls smoothly
- [ ] Materials picker responsive
- [ ] No stuttering or lag

### Memory
- [ ] No memory leaks visible
- [ ] Can create 50+ quotes
- [ ] Can scroll through large lists
- [ ] Images/PDFs don't crash app

---

## ✅ Final Checks

### Code Quality
- [ ] No console errors in Metro
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] All commits pushed to Git

### Documentation
- [ ] README accurate
- [ ] CLAUDE.md up to date
- [ ] API access requests ready
- [ ] QA checklist complete

### Tester Readiness
- [ ] Test accounts ready (if needed)
- [ ] Clear instructions provided
- [ ] Feedback form/method established
- [ ] Known issues documented

---

## 📝 Notes Section

### Issues Found:


### Improvements Needed:


### Questions for Testers:


---

## Sign-Off

- [ ] All critical paths tested
- [ ] All UI/UX checks passed
- [ ] No blocking bugs found
- [ ] Ready for tester deployment

**QA Performed By:** _____________
**Date:** _____________
**Build/Commit:** _____________
