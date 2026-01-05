#!/bin/bash
echo "🔑 Switching to SSH authentication..."

# Change remote URL from HTTPS to SSH
git remote set-url origin git@github.com:NaouresKraiem/kachabity.git

# Verify the change
echo ""
echo "✅ Remote URL updated to:"
git remote -v

echo ""
echo "📋 Next steps:"
echo "1. Make sure you have an SSH key: ls -la ~/.ssh"
echo "2. If no key exists, create one:"
echo "   ssh-keygen -t ed25519 -C 'your-email@example.com'"
echo "3. Add SSH key to GitHub:"
echo "   cat ~/.ssh/id_ed25519.pub"
echo "   Then paste in: GitHub → Settings → SSH and GPG keys → New SSH key"
echo "4. Try pushing again:"
echo "   git push --set-upstream origin feature/admin-dashboard"
