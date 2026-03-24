import React, { useState, useRef, useEffect } from 'react';
import SkeletonLoader from './SkeletonLoader';

const LazyImage = ({ src, alt = "Image", width = "100%", height = "auto", borderRadius = "8px", onLoad }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          const img = new Image();
          img.onload = () => {
            setImageSrc(src);
            setIsLoaded(true);
            if (onLoad) onLoad();
          };
          img.onerror = () => {
            setImageSrc(src);
            setIsLoaded(true);
          };
          img.src = src;
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, onLoad]);

  return (
    <div
      ref={imgRef}
      style={{
        width,
        height,
        borderRadius,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
    >
      {!isLoaded ? (
        <SkeletonLoader width={width} height={height} borderRadius={borderRadius} />
      ) : (
        <img
          src={imageSrc}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius,
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        />
      )}
    </div>
  );
};

export default LazyImage;
