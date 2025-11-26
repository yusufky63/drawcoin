"use client";

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-dotted border-art-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-1.5">
        <div className="flex items-center justify-between text-xs">
          {/* Left - Links */}
          <div className="flex items-center gap-3">
            <Link 
              href="/how-it-works" 
              className="text-art-gray-700 hover:text-art-gray-900 transition-colors font-semibold transform hover:-rotate-1"
            >
              How It Works
            </Link>
            <span className="text-art-gray-400">•</span>
            <a 
              href="https://twitter.com/DrawCoinBase" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-art-gray-700 hover:text-[#1DA1F2] transition-colors flex items-center gap-1.5 font-medium transform hover:rotate-1"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              Twitter
            </a>
            <span className="text-art-gray-400">•</span>
            <a 
              href="https://farcaster.xyz/drawcoin" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-art-gray-700 hover:text-[#855DCD] transition-colors flex items-center gap-1.5 font-medium transform hover:-rotate-1"
            >
              <Image 
                src="https://pbs.twimg.com/profile_images/1980310281558409216/DWoYcKR7_400x400.jpg" 
                alt="Farcaster" 
                width={24} 
                height={24} 
                className="rounded-full"
              />
              Farcaster
            </a>
            <span className="text-art-gray-400">•</span>
            <a 
              href="https://zora.co/@drawcoin" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-art-gray-700 hover:text-art-gray-900 transition-colors flex items-center gap-1.5 font-medium transform hover:rotate-1"
            >
              <Image 
                src="https://pbs.twimg.com/profile_images/1912995896226443264/R9N6BIXd_400x400.jpg" 
                alt="Zora" 
                width={24} 
                height={24} 
                className="rounded-full"
              />
              Zora
            </a>
          </div>

          {/* Right - Copyright */}
          <div className="text-art-gray-500 font-medium transform -rotate-0.5">
            © 2025 DrawCoin
          </div>
        </div>
      </div>
    </footer>
  );
}
