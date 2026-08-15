import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Building2, MessageSquare, Phone, Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PropertyCard from '../components/PropertyCard';

const heroImages = [
  '/assets/hero/hero1.jpg',
  '/assets/hero/hero2.jpg',
  '/assets/hero/hero3.jpg'
];

export default function Home() {
  const [properties, setProperties] = useState(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [houseTypeFilter, setHouseTypeFilter] = useState('');
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProperties(data || []);
      } catch (err) {
        console.error('Error fetching properties:', err.message);
        setProperties([]);
      }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const loading = properties === null;

  const filteredProperties = (properties || []).filter((prop) => {
    const matchesLoc = searchLocation === '' || 
      (prop.landmark && prop.landmark.toLowerCase().includes(searchLocation.toLowerCase())) ||
      (prop.title && prop.title.toLowerCase().includes(searchLocation.toLowerCase()));
    
    const matchesType = houseTypeFilter === '' || prop.house_type === houseTypeFilter;
    
    const propPrice = Number(prop.semester_rent || prop.price || prop.rent || 0);
    const matchesMin = minRent === '' || propPrice >= Number(minRent);
    const matchesMax = maxRent === '' || propPrice <= Number(maxRent);

    return matchesLoc && matchesType && matchesMin && matchesMax;
  });

  const handleSearch = () => {
    const listingsSection = document.getElementById('listings');
    if (listingsSection) {
      listingsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-24 pb-16">
      {/* Hero Section Expanded to Top */}
      <div className="relative w-screen left-[50%] -translate-x-[50%] min-h-screen flex items-center justify-center overflow-hidden bg-[#121215] -mt-8 md:-mt-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/50 z-10" />
          {heroImages.map((img, index) => (
            <img
              key={img}
              src={img}
              alt={`Hero slide ${index + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                index === currentImageIndex ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <div className="relative z-20 max-w-5xl mx-auto px-4 text-center py-24 flex flex-col items-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold mb-6 border border-blue-500/30">
            Chuka University Off-Campus Housing
          </span>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4">
            Find Your Next Student Home <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Direct & Verified
            </span>
          </h1>

          <p className="text-gray-300 text-base md:text-lg max-w-2xl mb-8">
            Connect directly with trusted landlords around Ndagani and campus. No brokers, no hidden fees.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <Link
              href="#listings"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3.5 rounded-xl transition shadow-lg shadow-blue-600/30"
            >
              Browse Listings
            </Link>
            <Link
              href="/add-property"
              className="bg-[#242427] hover:bg-[#2e2e33] text-white font-medium px-8 py-3.5 rounded-xl transition border border-white/10"
            >
              List Your Property
            </Link>
          </div>

          {/* Advanced Search & Filter Bar (Landmark, House Type, Price Range) */}
          <div className="w-full max-w-4xl bg-[#18181B]/95 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row gap-3 items-center">
            
            {/* Landmark Input */}
            <div className="flex-1 w-full bg-[#121215] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-gray-400">📍</span>
              <input
                type="text"
                placeholder="Landmark (e.g., Ndagani)..."
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="bg-transparent w-full text-white text-sm focus:outline-none placeholder-gray-500"
              />
            </div>

            {/* House Type Filter */}
            <div className="w-full md:w-48 bg-[#121215] border border-white/10 rounded-xl px-3 py-2.5">
              <select
                value={houseTypeFilter}
                onChange={(e) => setHouseTypeFilter(e.target.value)}
                className="bg-transparent w-full text-white text-sm focus:outline-none"
              >
                <option value="" className="bg-[#121215]">All House Types</option>
                <option value="Bedsitter" className="bg-[#121215]">Bedsitter</option>
                <option value="Single room" className="bg-[#121215]">Single room</option>
                <option value="1 Bedroom" className="bg-[#121215]">1 Bedroom</option>
                <option value="2 Bedroom" className="bg-[#121215]">2 Bedroom</option>
              </select>
            </div>

            {/* Price Range Inputs */}
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="number"
                placeholder="Min Ksh"
                value={minRent}
                onChange={(e) => setMinRent(e.target.value)}
                className="w-full md:w-28 bg-[#121215] border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Max Ksh"
                value={maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
                className="w-full md:w-28 bg-[#121215] border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none placeholder-gray-500"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 whitespace-nowrap"
            >
              <span>🔍 Search</span>
            </button>
          </div>

        </div>
      </div>

      {/* Trust Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex items-start gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Verified Landlords</h3>
            <p className="text-gray-400 text-sm mt-1">Direct contact with authentic caretakers around Chuka University.</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex items-start gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Transparent Pricing</h3>
            <p className="text-gray-400 text-sm mt-1">Clear monthly rent with zero agent markup or surprise broker fees.</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Instant WhatsApp Connect</h3>
            <p className="text-gray-400 text-sm mt-1">Inquire and schedule viewings with a single tap on mobile or desktop.</p>
          </div>
        </div>
      </section>

      {/* Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-4 my-6">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={22} />
        <div className="space-y-1">
          <h4 className="text-amber-400 font-semibold text-sm sm:text-base">Before you pay anyone</h4>
          <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
            Never send rent or a deposit before you have seen the room in person. If anything here is wrong reach us through <strong className="text-white font-medium">0708797271</strong>.
          </p>
        </div>
      </div>

      {/* Property Listings Grid Section */}
      <section id="listings" className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Available Housing</h2>
            <p className="text-gray-400 mt-1">Explore verified rentals near campus.</p>
          </div>
          <span className="text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mt-2 md:mt-0">
            {filteredProperties.length} Properties Available
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 bg-[#18181B] rounded-2xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="p-12 text-center bg-[#18181B] rounded-2xl border border-white/10 space-y-3">
            <p className="text-gray-300 font-medium text-lg">No properties match your current search.</p>
            <p className="text-gray-500 text-sm">Try clearing your filters to see all listings.</p>
            <button 
              onClick={() => { setSearchLocation(''); setHouseTypeFilter(''); setMinRent(''); setMaxRent(''); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm transition mt-2"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>

      {/* Support Section */}
      <section className="bg-[#18181B] border border-white/10 rounded-3xl p-8 md:p-12 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Need Help Finding Housing?</h2>
          <p className="text-gray-400">
            Have questions about a listing or want to register as a landlord? Get in touch directly with our support team.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 pt-4">
          <a 
            href="mailto:victornyaga21@gmail.com" 
            className="flex items-center gap-3 px-6 py-3.5 bg-[#242427] hover:bg-[#2c2c30] border border-white/10 rounded-2xl text-gray-200 hover:text-white transition"
          >
            <Mail className="text-blue-400" size={20} />
            <span className="font-medium">victornyaga21@gmail.com</span>
          </a>

          <a 
            href="https://wa.me/254708797271" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3.5 bg-[#242427] hover:bg-[#2c2c30] border border-white/10 rounded-2xl text-gray-200 hover:text-white transition"
          >
            <Phone className="text-emerald-400" size={20} />
            <span className="font-medium">+254 708 797 271</span>
          </a>
        </div>
      </section>
    </div>
  );
}