import React, { useState, useEffect, useRef } from 'react';
import tentOutside from '../images/private_bookings/tent_outside.png';
import tentInside from '../images/private_bookings/tent_inside.png';
import oneTentPalmTree from '../images/private_bookings/one_tent_palm_tree.jpeg';
import twoTentsSunrise from '../images/private_bookings/two_tents_sunrise.jpeg';
import squad from '../images/private_bookings/squad.jpeg';

const PHOTOS = [
  tentOutside,
  tentInside,
  oneTentPalmTree,
  twoTentsSunrise,
  squad,
];

function PhotoCollage() {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const autoScrollRef = useRef(null);

  const scrollTo = (index) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: index * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / clientWidth);
    setActiveIndex(index);
  };

  const startAutoScroll = () => {
    stopAutoScroll();
    autoScrollRef.current = setInterval(() => {
      setActiveIndex(prev => {
        const next = (prev + 1) % PHOTOS.length;
        scrollTo(next);
        return next;
      });
    }, 3000);
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
  };

  useEffect(() => {
    startAutoScroll();
    return stopAutoScroll;
  }, []);

  const scrollLeft = () => {
    stopAutoScroll();
    if (!scrollRef.current) return;
    const width = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({ left: -width, behavior: 'smooth' });
    startAutoScroll();
  };

  const scrollRight = () => {
    stopAutoScroll();
    if (!scrollRef.current) return;
    const width = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({ left: width, behavior: 'smooth' });
    startAutoScroll();
  };

  return (
    <div className="photo-collage" onMouseEnter={stopAutoScroll} onMouseLeave={startAutoScroll}>
      <button className="photo-arrow left" onClick={scrollLeft} aria-label="Previous photo">‹</button>
      <div className="photo-scroll" ref={scrollRef} onScroll={handleScroll}>
        {PHOTOS.map((src, i) => (
          <img key={i} src={src} alt={`Sauna experience ${i + 1}`} className="photo-slide" />
        ))}
      </div>
      <button className="photo-arrow right" onClick={scrollRight} aria-label="Next photo">›</button>
      <div className="photo-dots">
        {PHOTOS.map((_, i) => (
          <button
            key={i}
            className={`photo-dot ${i === activeIndex ? 'active' : ''}`}
            onClick={() => scrollTo(i)}
          />
        ))}
      </div>
    </div>
  );
}

export default PhotoCollage;
