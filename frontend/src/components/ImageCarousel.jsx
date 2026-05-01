import React, { useEffect, useState } from 'react'

const slides = [
  {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
    alt: 'Ticket analytics dashboard showing trend charts and KPI metrics',
    caption: 'Ticket Analytics: visualize SLA risk, queue trends, and escalation hotspots in real time.',
  },
  {
    type: 'video',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1600&q=80',
    alt: 'Generative AI style neural network motion graphic',
    caption: 'Generative AI: accelerate triage with smart summaries, guided clarifications, and contextual suggestions.',
  },
  {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1600&q=80',
    alt: 'Machine learning workflow visualized with data nodes and model outputs',
    caption: 'Machine Learning: improve routing precision using learned patterns from historical ticket behavior.',
  },
  {
    type: 'video',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/river.mp4',
    poster: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80',
    alt: 'AI operations center with collaborative support engineering activity',
    caption: 'AI Operations: short live-motion view of teams monitoring incidents and collaborative triage.',
  },
  {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1600&q=80',
    alt: 'Software engineer analyzing support metrics and dashboards',
    caption: 'Ticket Analytics + AI Operations: align teams with a shared view of performance and incident flow.',
  },
  {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
    alt: 'Machine learning hardware and compute-focused engineering setup',
    caption: 'Generative AI + Machine Learning: blend natural language reasoning with predictive intelligence.',
  },
]

export default function ImageCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [failedSlides, setFailedSlides] = useState({})

  const markSlideFailed = (index) => {
    setFailedSlides((previous) => ({
      ...previous,
      [index]: true,
    }))
  }

  const getSlidePosition = (index) => {
    const total = slides.length
    const forward = (index - activeIndex + total) % total

    if (forward === 0) {
      return 'front'
    }

    if (forward === 1) {
      return 'right'
    }

    if (forward === total - 1) {
      return 'left'
    }

    if (forward === 2) {
      return 'far-right'
    }

    if (forward === total - 2) {
      return 'far-left'
    }

    return 'hidden'
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="image-carousel" aria-label="AI image carousel">
      <div className="carousel-view">
        <div className="carousel-stage">
          {slides.map((slide, index) => {
            const position = getSlidePosition(index)
            return (
              <article
                key={slide.src}
                className={`carousel-card carousel-card-${position}`}
                aria-hidden={position !== 'front'}
              >
                {failedSlides[index] && slide.poster ? (
                  <img
                    src={slide.poster}
                    alt={slide.alt}
                    className="carousel-image"
                    loading="eager"
                  />
                ) : failedSlides[index] ? (
                  <div className="carousel-media-fallback" role="img" aria-label={slide.alt}>
                    <span className="material-symbols-outlined">broken_image</span>
                    <p>Media unavailable</p>
                  </div>
                ) : slide.type === 'video' ? (
                  <video
                    key={`${slide.src}-${position === 'front' ? 'active' : 'stacked'}`}
                    className="carousel-video"
                    src={slide.src}
                    poster={slide.poster}
                    muted
                    loop
                    playsInline
                    autoPlay={position === 'front'}
                    preload="metadata"
                    onError={() => markSlideFailed(index)}
                  />
                ) : (
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className="carousel-image"
                    loading="eager"
                    onError={() => markSlideFailed(index)}
                  />
                )}
              </article>
            )
          })}
        </div>
        <div key={`caption-${activeIndex}`} className="carousel-caption">
          <p>{slides[activeIndex].caption}</p>
        </div>
      </div>
      <div className="carousel-controls">
        <button
          type="button"
          className="carousel-button"
          onClick={() => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)}
          aria-label="Previous image"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          type="button"
          className="carousel-button"
          onClick={() => setActiveIndex((prev) => (prev + 1) % slides.length)}
          aria-label="Next image"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <div className="carousel-indicators">
        {slides.map((slide, index) => {
          const indicatorClass = [
            'carousel-indicator',
            index === activeIndex ? 'active' : '',
            slide.type === 'video' ? 'video-indicator' : '',
          ]
            .filter(Boolean)
            .join(' ')

          const mediaTypeLabel = slide.type === 'video' ? 'video' : 'image'

          return (
            <button
              key={index}
              type="button"
              className={indicatorClass}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${mediaTypeLabel} ${index + 1}`}
            />
          )
        })}
      </div>
    </section>
  )
}
