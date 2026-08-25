import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function AddProperty() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [houseType, setHouseType] = useState('Bedsitter');
  const [landmark, setLandmark] = useState('');
  const [walkingTime, setWalkingTime] = useState('');
  const [vacantRooms, setVacantRooms] = useState('');
  const [price, setPrice] = useState(''); // Semester rent
  const [whatsapp, setWhatsapp] = useState('');
  const [description, setDescription] = useState(''); // Extra information

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth');
        return;
      }

      const { data: accountProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (accountProfile?.role !== 'landlord' && accountProfile?.role !== 'admin') {
        router.replace('/landlord');
        return;
      }

      const response = await fetch('/api/phone-verification/status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const phoneStatus = await response.json();

      if (response.ok) {
        setPhoneVerified(Boolean(phoneStatus.phoneVerified));
        if (phoneStatus.phoneVerified && phoneStatus.phoneNumber) {
          setWhatsapp(phoneStatus.phoneNumber);
        }
      }
    };
    init();
  }, [router]);

  // 6 Image Files State
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Structured Amenities State
  const [amenities, setAmenities] = useState({
    electricity: { available: false, type: 'Prepaid Tokens' },
    water: { available: false, type: 'Free Running Water', cost: '' },
    security: { available: false, type: 'Security Guard' },
    wifi: { available: false }
  });

  // Handle Image Selection (Max 6)
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imageFiles.length > 6) {
      alert('You can upload a maximum of 6 images.');
      return;
    }

    const newFiles = [...imageFiles, ...files].slice(0, 6);
    setImageFiles(newFiles);

    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
  };

  const removeImage = (index) => {
    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('You must be logged in as a landlord to list a property.');
      }

      const { data: phoneStatus, error: phoneStatusError } = await supabase
        .from('profiles')
        .select('phone_number, phone_verified, role')
        .eq('id', user.id)
        .maybeSingle();

      if (phoneStatusError) throw phoneStatusError;

      if (phoneStatus?.role !== 'landlord' && phoneStatus?.role !== 'admin') {
        router.push('/landlord');
        return;
      }

      if (!phoneStatus?.phone_verified) {
        router.push('/phone-verification?returnTo=/add-property');
        return;
      }

      const verifiedPhone = phoneStatus.phone_number;
      if (!verifiedPhone) {
        throw new Error('Your account is marked verified but has no phone number. Please contact support.');
      }

      const { error: landlordUpsertError } = await supabase
        .from('landlords')
        .upsert({ id: user.id, email: user.email, full_name: user.email || 'Landlord' }, { onConflict: 'id' });

      if (landlordUpsertError) {
        console.error('Landlord profile error:', landlordUpsertError.message);
      }

      const imageUrls = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(filePath);

        imageUrls.push(publicUrlData.publicUrl);
      }

      const propertyPayload = {
        title,
        house_type: houseType,
        landmark,
        walk_mins: parseInt(walkingTime, 10),
        vacant_rooms: parseInt(vacantRooms, 10),
        semester_rent: parseFloat(price),
        whatsapp: verifiedPhone,
        images: imageUrls,
        description: description.trim(),
        electricity_type: amenities.electricity.available
          ? amenities.electricity.type
          : null,
        water_type: amenities.water.available
          ? amenities.water.type
          : null,
        water_cost:
          amenities.water.available &&
          amenities.water.type === 'Tokens / Metered' &&
          amenities.water.cost
            ? parseFloat(amenities.water.cost)
            : null,
        security_system: amenities.security.available
          ? amenities.security.type
          : null,
        wifi_available: amenities.wifi.available,
        status: 'vacant',
        listing_status: 'pending',
        verification_status: 'unverified',
        user_id: user.id,
        landlord_id: user.id
      };

      const { data, error } = await supabase
        .from('properties')
        .insert([propertyPayload]);

      if (error) {
        console.error('Error publishing listing:', error.message);
        alert(`Failed to publish: ${error.message}`);
        setLoading(false);
        return;
      }

      console.log('Listing published successfully:', data);
      router.push('/landlord/dashboard');
    } catch (err) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto bg-[#121215] border border-white/10 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-2">List a New Property</h1>
        <p className="text-gray-400 mb-8">Empower students with transparent hostel details and real-time availability.</p>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Property / Hostel Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sunrise Hostels"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">House Type *</label>
              <select
                value={houseType}
                onChange={(e) => setHouseType(e.target.value)}
                className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Bedsitter">Bedsitter</option>
                <option value="Single room">Single room</option>
                <option value="1 Bedroom">1 Bedroom</option>
                <option value="2 Bedroom">2 Bedroom</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Location/Landmark *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Ndagani"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Walk (Mins) *</label>
              <input
                type="number"
                required
                placeholder="5"
                value={walkingTime}
                onChange={(e) => setWalkingTime(e.target.value)}
                className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Vacant Rooms *</label>
              <input
                type="number"
                required
                placeholder="3"
                value={vacantRooms}
                onChange={(e) => setVacantRooms(e.target.value)}
                className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Semester Rent *</label>
              <input
                type="number"
                required
                placeholder="25000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Verified Contact Number</label>
            <div className="flex items-center justify-between gap-3 bg-[#18181B] border border-emerald-500/20 rounded-xl px-4 py-3">
              <span className="text-gray-200">{whatsapp || 'Phone verification required'}</span>
              {phoneVerified ? (
                <span className="text-xs font-semibold text-emerald-400">Verified ✓</span>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/phone-verification?returnTo=/add-property')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  Verify now
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This verified number will be used as the primary contact for this listing.
            </p>
          </div>

          {/* Structured Amenities Section */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold mb-4">Property Amenities & Specifications</h3>
            
            <div className="space-y-4 bg-[#18181B]/50 p-6 rounded-xl border border-white/5">
              {/* Electricity */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenities.electricity.available}
                    onChange={(e) => setAmenities({
                      ...amenities,
                      electricity: { ...amenities.electricity, available: e.target.checked }
                    })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                  <span className="font-medium">Electricity</span>
                </label>
                {amenities.electricity.available && (
                  <select
                    value={amenities.electricity.type}
                    onChange={(e) => setAmenities({
                      ...amenities,
                      electricity: { ...amenities.electricity, type: e.target.value }
                    })}
                    className="bg-[#121215] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="Prepaid Tokens">Prepaid Tokens</option>
                    <option value="Postpaid">Postpaid Meter</option>
                  </select>
                )}
              </div>

              {/* Water */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenities.water.available}
                    onChange={(e) => setAmenities({
                      ...amenities,
                      water: { ...amenities.water, available: e.target.checked }
                    })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                  <span className="font-medium">Water Supply</span>
                </label>
                {amenities.water.available && (
                  <div className="flex items-center gap-3">
                    <select
                      value={amenities.water.type}
                      onChange={(e) => setAmenities({
                        ...amenities,
                        water: { ...amenities.water, type: e.target.value }
                      })}
                      className="bg-[#121215] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="Free Running Water">Free Running Water</option>
                      <option value="Tokens / Metered">Tokens / Metered</option>
                    </select>
                    {amenities.water.type === 'Tokens / Metered' && (
                      <input
                        type="text"
                        placeholder="Cost per unit (e.g. KES 50)"
                        value={amenities.water.cost}
                        onChange={(e) => setAmenities({
                          ...amenities,
                          water: { ...amenities.water, cost: e.target.value }
                        })}
                        className="bg-[#121215] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-48"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Security */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenities.security.available}
                    onChange={(e) => setAmenities({
                      ...amenities,
                      security: { ...amenities.security, available: e.target.checked }
                    })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                  <span className="font-medium">Security System</span>
                </label>
                {amenities.security.available && (
                  <select
                    value={amenities.security.type}
                    onChange={(e) => setAmenities({
                      ...amenities,
                      security: { ...amenities.security, type: e.target.value }
                    })}
                    className="bg-[#121215] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="Security Guard">Security Guard</option>
                    <option value="Gated Compound">Gated Compound</option>
                    <option value="Biometric Access">Biometrics</option>
                  </select>
                )}
              </div>

              {/* Wi-Fi */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenities.wifi.available}
                    onChange={(e) => setAmenities({
                      ...amenities,
                      wifi: { ...amenities.wifi, available: e.target.checked }
                    })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                  <span className="font-medium">High-Speed Wi-Fi Available</span>
                </label>
              </div>
            </div>
          </div>

          {/* Photo Upload Grid (Max 6) */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold mb-2">Property Photos (Max 6)</h3>
            <p className="text-gray-400 text-sm mb-4">Upload clear pictures of the room, kitchen, and bathroom.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {imagePreviews.map((src, index) => (
                <div key={index} className="relative h-32 bg-[#18181B] rounded-xl overflow-hidden border border-white/10">
                  <img src={src} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {imagePreviews.length < 6 && (
                <label className="h-32 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition bg-[#18181B]/30">
                  <span className="text-2xl mb-1">+</span>
                  <span className="text-xs text-gray-400">Add Photo ({imagePreviews.length}/6)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Extra Information / Description */}
          <div className="border-t border-white/10 pt-6">
            <label className="block text-sm font-medium mb-2">Extra Information / Description</label>
            <textarea
              rows="4"
              placeholder="Add any extra details, deposit terms, rules, or caretaker instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading || !phoneVerified}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? 'Publishing Listing...' : phoneVerified ? 'Publish Property Listing' : 'Verify Phone to Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
