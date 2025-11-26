import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getWorkingIpfsUrl, isIpfsUrl, getImageFromIpfsMetadata } from '../../utils/ipfs';
import { Camera } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackText?: string;
  fallbackIcon?: React.ReactNode;
  fluid?: boolean;
  lazy?: boolean; // Enable lazy loading
}

export function SafeImage({ 
  src, 
  alt, 
  width = 100, 
  height = 100, 
  className = '', 
  fallbackText = 'NO IMAGE',
  fallbackIcon = <Camera size={20} />,
  fluid = false,
  lazy = true // Default lazy loading enabled
}: SafeImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(!lazy); // If not lazy, always visible
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px', // Load 200px before coming into view
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, isVisible]);

  // Load image only when visible
  useEffect(() => {
    if (!src || !isVisible) {
      if (!src) {
        setImageError(true);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setImageError(false);
    
    // Handle IPFS URLs - they might contain metadata JSON
    if (isIpfsUrl(src)) {
      const loadIpfsImage = async () => {
        try {
          // First try to get image from metadata
          const imageUrl = await getImageFromIpfsMetadata(src);
          if (imageUrl) {
            setImageSrc(imageUrl);
          } else {
            // Fallback: treat as direct image
            const httpUrl = getWorkingIpfsUrl(src);
            setImageSrc(httpUrl);
          }
        } catch (error) {
          console.error('Error loading IPFS image:', error);
          setImageError(true);
          setIsLoading(false);
        }
      };
      
      loadIpfsImage();
    } else {
      setImageSrc(src);
    }
  }, [src, isVisible]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  // Placeholder for lazy loading (before visible)
  if (!isVisible) {
    return (
      <div 
        ref={imgRef}
        className={`flex items-center justify-center bg-gradient-to-br from-art-gray-100 to-art-gray-200 ${className} ${fluid ? 'w-full h-full' : ''}`}
        style={fluid ? undefined : { width, height }}
      >
        <div className="animate-pulse">
          <div className="w-8 h-8 bg-art-gray-300 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (imageError || !imageSrc) {
    return (
      <div 
        ref={imgRef}
        className={`flex items-center justify-center bg-retro-darker/30 border border-retro-primary/30 ${className} ${fluid ? 'w-full h-full' : ''}`}
        style={fluid ? undefined : { width, height }}
      >
        <div className="text-center">
          <div className="text-retro-primary mb-1">{fallbackIcon}</div>
          <div className="text-retro-secondary text-xs">{fallbackText}</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={imgRef}
      className={`relative ${className} ${fluid ? 'w-full h-full' : ''}`} 
      style={fluid ? undefined : { width, height }}
    >
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-retro-darker/50"
          style={fluid ? undefined : { width, height }}
        >
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-retro-primary"></div>
        </div>
      )}
      {fluid ? (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          className={`object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} ${className || ''}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          unoptimized
          loading={lazy ? "lazy" : "eager"}
          priority={!lazy}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      ) : (
        <Image
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={`object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} ${className || ''}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          unoptimized
          loading={lazy ? "lazy" : "eager"}
          priority={!lazy}
        />
      )}
    </div>
  );
} 
