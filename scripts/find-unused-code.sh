#!/bin/bash

# Script to find potentially unused code in the project
# Run this from the landing/ directory

echo "🔍 Finding Unused Code..."
echo "=========================="

echo ""
echo "1. Finding unused exports..."
echo "----------------------------"
# This will help identify exports that are never imported
npx ts-prune --error | head -20

echo ""
echo "2. Finding unused npm packages..."
echo "----------------------------"
npx depcheck --ignores="@types/*,eslint*,typescript" | head -30

echo ""
echo "3. Finding large files (>500 lines)..."
echo "----------------------------"
find app components lib -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -15

echo ""
echo "4. Finding duplicate code patterns..."
echo "----------------------------"
echo "Checking for repeated getProductName patterns:"
grep -r "locale === 'ar' && product.name_ar" app/ components/ --include="*.tsx" | wc -l
echo "files with this pattern found"

echo ""
echo "5. Finding console.log statements..."
echo "----------------------------"
grep -r "console\." app/ components/ --include="*.tsx" --include="*.ts" | wc -l
echo "console statements found"

echo ""
echo "6. Finding commented out code..."
echo "----------------------------"
grep -r "{/\*.*<.*\*/}" app/ components/ --include="*.tsx" | wc -l
echo "commented JSX blocks found"

echo ""
echo "✅ Analysis Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Review large files and split them"
echo "  2. Remove unused imports with ESLint"
echo "  3. Replace duplicate code with utilities"
echo "  4. Remove console.log statements"

