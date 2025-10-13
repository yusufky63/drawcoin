import React, { useState, useEffect } from 'react';
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
}

export function SafeImage({ 
  src, 
  alt, 
  width = 100, 
  height = 100, 
  className = '', 
  fallbackText = 'NO IMAGE',
  fallbackIcon = <Camera size={20} />,
  fluid = false
}: SafeImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) {
      setImageError(true);
      setIsLoading(false);
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
  }, [src]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  if (imageError || !imageSrc) {
    return (
      <div 
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
    <div className={`relative ${className} ${fluid ? 'w-full h-full' : ''}`} style={fluid ? undefined : { width, height }}>
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
          className={`object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          unoptimized
        />
      ) : (
        <Image
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={`object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          unoptimized
        />
      )}
    </div>
  );
} 
