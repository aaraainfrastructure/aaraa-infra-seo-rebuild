import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const locations = [
  { name: 'Lucknow', state: 'Uttar Pradesh', desc: 'Institutional & Infrastructure Operations', x: 47.0, y: 31.0, align: 'right' },
  { name: 'Mumbai', state: 'Maharashtra', desc: 'Regional Contracting & Industrial Works', x: 38.0, y: 53.0, align: 'left' },
  { name: 'Pune', state: 'Maharashtra', desc: 'Institutional & PEB Project Execution', x: 39.5, y: 54.5, align: 'right' },
  { name: 'Hyderabad', state: 'Telangana', desc: 'Urban Infrastructure & Commercial Operations', x: 45.8, y: 58.5, align: 'right' },
  { name: 'Kudligi', state: 'Karnataka', desc: '132 MW Wind-Solar Hybrid Project Hub', x: 41.5, y: 64.5, align: 'left' },
  { name: 'Amaravathi', state: 'Andhra Pradesh', desc: 'Key Infrastructure Development Works', x: 48.5, y: 64.0, align: 'right' },
  { name: 'Bengaluru', state: 'Karnataka', desc: 'Regional Corporate & Technical Center', x: 43.0, y: 71.5, align: 'left' },
  { name: 'Chennai', state: 'Tamil Nadu', desc: 'Corporate Head Office & Engineering Operations', x: 47.6, y: 70.0, align: 'right' },
  { name: 'Coimbatore', state: 'Tamil Nadu', desc: 'Industrial Projects & PEB Execution', x: 42.0, y: 75.5, align: 'right' },
  { name: 'Thoothukudi', state: 'Tamil Nadu', desc: '180 MWp Utility-Scale Solar EPC Project Hub', x: 44.2, y: 81.5, align: 'right' }
];

export default function MapPresence({
  title = "Engineering Excellence Across India",
  badge = "STRATEGIC PRESENCE",
  description = "AARAA Infrastructure delivers complex engineering, industrial, utility-scale energy, and infrastructure solutions across key growth corridors of India. Our geographically distributed project footprint enables rapid execution, efficient resource deployment, and consistent project delivery standards nationwide."
}) {
  const [activeLoc, setActiveLoc] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-[#0b0b18] py-24 text-white">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_10%_90%,rgba(234,42,49,0.08)_0%,transparent_80%)]" />
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Column: Details */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="lg:col-span-5 z-10"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-500/12 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#ea2a31]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ea2a31]" />
              {badge}
            </span>
            
            <h2 className="mt-6 font-montserrat text-4xl font-extrabold tracking-tight lg:text-5xl leading-tight">
              {title}
            </h2>
            
            <p className="mt-6 text-base leading-relaxed text-white/70">
              {description}
            </p>

            <div className="mt-8">
              <a 
                className="inline-flex items-center gap-4 rounded border border-white/10 bg-[#ea2a31] hover:bg-white hover:text-[#0b0b18] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-all duration-300 shadow-lg" 
                href="completed-projects.html"
                aria-label="View AARAA completed projects"
              >
                <span>View Our Projects</span>
                <i className="icon-arrow-right"></i>
              </a>
            </div>
          </motion.div>

          {/* Right Column: Map wrapper */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="lg:col-span-7"
          >
            <div className="rounded-[24px] border border-white/6 bg-white/1 p-4 shadow-2xl relative">
              <div className="relative w-100 aspect-[1672/941] rounded-2xl overflow-hidden bg-[#021028]">
                <img 
                  src="image/map.webp" 
                  alt="AARAA Infrastructure Operational Presence Map India" 
                  className="w-full h-full object-cover select-none pointer-events-none"
                />

                {/* Markers Overlay */}
                <div className="absolute inset-0 z-10">
                  {locations.map((loc, idx) => {
                    const isActive = activeLoc?.name === loc.name;
                    return (
                      <div
                        key={loc.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLoc(loc);
                        }}
                        style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                        className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                      >
                        {/* Core circle */}
                        <motion.div 
                          animate={{ 
                            scale: isActive ? 1.4 : 1,
                            backgroundColor: isActive ? '#ffffff' : '#ea2a31',
                            borderColor: isActive ? '#ea2a31' : '#ffffff'
                          }}
                          className="w-2.5 h-2.5 bg-[#ea2a31] border-2 border-white rounded-full absolute top-[3px] left-[3px] shadow-[0_0_10px_rgba(234,42,49,0.8)] z-10"
                        />

                        {/* Pulse Ring */}
                        <motion.div 
                          animate={{ 
                            scale: [0.3, 2],
                            opacity: [0.8, 0]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: 'easeOut',
                            delay: (idx % 4) * 0.5
                          }}
                          className="w-8 h-8 border-2 border-[#ea2a31] bg-red-500/20 rounded-full absolute -top-2 -left-2 z-0"
                        />

                        {/* Permanent Visual Label (Pill style) */}
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 bg-white text-[#0b0b18] px-2.5 py-1 text-[11px] font-bold rounded-full border border-white/20 shadow-md font-sans whitespace-nowrap pointer-events-none z-10 transition-all duration-250 group-hover:scale-108 md:block hidden ${
                            loc.align === 'left' ? 'right-5 left-auto' : 'left-5 right-auto'
                          }`}
                        >
                          {loc.name}
                        </div>

                        {/* Hover Tooltip (Details) */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 translate-y-2.5 opacity-0 pointer-events-none transition-all duration-250 group-hover:opacity-100 group-hover:translate-y-0 z-30 bg-slate-950/95 border border-red-500/25 text-white p-3.5 rounded-xl w-[240px] shadow-2xl font-sans text-left">
                          <div className="font-montserrat text-sm font-extrabold text-white">{loc.name}</div>
                          <div className="text-[11px] font-bold uppercase text-[#ea2a31] tracking-wider mt-0.5">{loc.state}</div>
                          <div className="text-xs text-white/80 mt-2 font-medium leading-relaxed">{loc.desc}</div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-6 border-x-transparent border-t-6 border-t-slate-950/95" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tooltip Popup (Desktop Absolute Overlay) */}
                <AnimatePresence>
                  {activeLoc && !isMobile && (
                    <motion.div 
                      key="desktop-popup"
                      style={{ left: `${activeLoc.x}%`, top: `${activeLoc.y}%` }}
                      className="absolute pointer-events-none z-40"
                    >
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10, x: '-50%' }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, scale: 0.9, y: 10, x: '-50%' }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="pointer-events-auto absolute bottom-6 bg-slate-950/95 border border-red-500/30 rounded-xl p-4 w-[280px] shadow-2xl font-sans"
                      >
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLoc(null);
                          }}
                          className="absolute top-2.5 right-3 text-white/50 hover:text-red-500 text-lg line-none p-1"
                        >
                          &times;
                        </button>
                        <h4 className="font-montserrat text-lg font-extrabold text-white">{activeLoc.name}</h4>
                        <div className="text-xs font-bold uppercase text-[#ea2a31] tracking-wider mt-0.5">{activeLoc.state}</div>
                        <div className="text-[10px] text-white/45 uppercase tracking-wide mt-3">Presence Details</div>
                        <div className="text-sm text-white/85 mt-1 font-medium leading-relaxed">{activeLoc.desc}</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-slate-950/95" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>

              {/* Mobile details block (rendered below the map) */}
              <AnimatePresence>
                {activeLoc && isMobile && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden z-30"
                  >
                    <div className="mt-4 bg-white/2 border border-red-500/20 rounded-xl p-4 relative font-sans">
                      <button 
                        onClick={() => setActiveLoc(null)}
                        className="absolute top-2.5 right-3 text-white/50 hover:text-red-500 text-lg line-none p-1"
                      >
                        &times;
                      </button>
                      <h4 className="font-montserrat text-lg font-extrabold text-white">{activeLoc.name}</h4>
                      <div className="text-xs font-bold uppercase text-[#ea2a31] tracking-wider mt-0.5">{activeLoc.state}</div>
                      <div className="text-[10px] text-white/45 uppercase tracking-wide mt-3">Presence Details</div>
                      <div className="text-sm text-white/85 mt-1 font-medium leading-relaxed">{activeLoc.desc}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
