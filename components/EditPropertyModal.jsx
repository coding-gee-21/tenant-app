import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ImagePlus, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 bg-[#121215] text-sm text-gray-400">
      Loading location tools...
    </div>
  ),
});

function initialForm(property) {
  return {
    title: property.title || '',
    house_type: property.house_type || 'Bedsitter',
    landmark: property.landmark || '',
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    location_accuracy_meters:
      property.location_accuracy_meters ?? null,
    walk_mins: property.walk_mins ?? '',
    vacant_rooms: property.vacant_rooms ?? '',
    semester_rent:
      property.semester_rent ?? property.price ?? property.rent ?? '',
    whatsapp: property.whatsapp || '',
    landlord_display_name: property.landlord_display_name || '',
    caretaker_name: property.caretaker_name || '',
    caretaker_phone: property.caretaker_phone || '',
    caretaker_hours: property.caretaker_hours || '',
    deposit_amount: property.deposit_amount ?? '',
    electricity_cost: property.electricity_cost ?? '',
    wifi_cost: property.wifi_cost ?? '',
    other_charges: property.other_charges || '',
    security_lighting: Boolean(property.security_lighting),
    cctv_available: Boolean(property.cctv_available),
    electricity_available: Boolean(property.electricity_type),
    electricity_type: property.electricity_type || 'Prepaid Tokens',
    water_available: Boolean(property.water_type),
    water_type: property.water_type || 'Free Running Water',
    water_cost: property.water_cost ?? '',
    security_available: Boolean(property.security_system),
    security_system: property.security_system || 'Security Guard',
    wifi_available: Boolean(property.wifi_available),
    description: property.description || '',
    images: Array.isArray(property.images) ? property.images : [],
  };
}

function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  return Number(value);
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#18181B] px-4 py-3 text-white outline-none focus:border-blue-500';

export default function EditPropertyModal({
  property,
  verifiedPhone,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => initialForm(property));
  const [newImages, setNewImages] = useState([]);
  const newImagesRef = useRef([]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    newImagesRef.current = newImages;
  }, [newImages]);

  useEffect(() => {
    return () => {
      newImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.preview)
      );
    };
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLocation(location) {
    setForm((current) => ({
      ...current,
      latitude: location.lat,
      longitude: location.lng,
      location_accuracy_meters: location.accuracy ?? null,
    }));
  }

  function addImages(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const remainingSlots = 6 - form.images.length - newImages.length;

    if (remainingSlots <= 0) {
      setErrorMessage('A listing can contain a maximum of 6 photos.');
      event.target.value = '';
      return;
    }

    const validFiles = selectedFiles.filter(
      (file) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
        file.size <= 5 * 1024 * 1024
    );
    const acceptedFiles = validFiles.slice(0, remainingSlots);
    const additions = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setNewImages((current) => [...current, ...additions]);
    setErrorMessage(
      validFiles.length !== selectedFiles.length
        ? 'Only JPG, PNG or WebP photos smaller than 5 MB can be uploaded.'
        : selectedFiles.length > remainingSlots
        ? `Only ${remainingSlots} additional photo${remainingSlots === 1 ? '' : 's'} could be added.`
        : ''
    );
    event.target.value = '';
  }

  function removeExistingImage(index) {
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index),
    }));
  }

  function removeNewImage(index) {
    setNewImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((_, imageIndex) => imageIndex !== index);
    });
  }

  async function submit(event) {
    event.preventDefault();
    setErrorMessage('');

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const walkMinutes = Number(form.walk_mins);
    const vacantRooms = Number(form.vacant_rooms);
    const semesterRent = Number(form.semester_rent);
    const optionalCosts = [
      form.deposit_amount,
      form.electricity_cost,
      form.wifi_cost,
      form.water_cost,
    ]
      .filter((value) => value !== '' && value !== null)
      .map(Number);

    if (!form.title.trim() || !form.landmark.trim()) {
      setErrorMessage('The property title and landmark are required.');
      return;
    }

    if (!form.landlord_display_name.trim()) {
      setErrorMessage('Enter the landlord display name.');
      return;
    }

    if (
      form.latitude === null ||
      form.longitude === null ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setErrorMessage(
        'Select and confirm the correct hostel location before saving.'
      );
      return;
    }

    if (!Number.isFinite(walkMinutes) || walkMinutes < 0) {
      setErrorMessage('Walking time must be zero or a positive number.');
      return;
    }

    if (!Number.isInteger(vacantRooms) || vacantRooms < 0) {
      setErrorMessage('Vacant rooms must be a whole number of zero or more.');
      return;
    }

    if (!Number.isFinite(semesterRent) || semesterRent < 0) {
      setErrorMessage('Semester rent must be zero or a positive amount.');
      return;
    }

    if (
      optionalCosts.some(
        (amount) => !Number.isFinite(amount) || amount < 0
      )
    ) {
      setErrorMessage('Additional charges cannot contain negative amounts.');
      return;
    }

    const contactNumber = verifiedPhone || form.whatsapp;

    if (!contactNumber) {
      setErrorMessage(
        'Your landlord account needs a verified contact number before this listing can be saved.'
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const uploadedImages = [];

      for (let index = 0; index < newImages.length; index += 1) {
        const file = newImages[index].file;
        const extension =
          file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${user.id}-${Date.now()}-${index}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(filePath);

        uploadedImages.push(publicUrlData.publicUrl);
      }

      const now = new Date().toISOString();
      const payload = {
        title: form.title.trim(),
        house_type: form.house_type,
        landmark: form.landmark.trim(),
        latitude,
        longitude,
        location_accuracy_meters:
          form.location_accuracy_meters === null
            ? null
            : Number(form.location_accuracy_meters),
        location_updated_at: now,
        walk_mins: walkMinutes,
        vacant_rooms: vacantRooms,
        semester_rent: semesterRent,
        whatsapp: contactNumber,
        landlord_display_name: form.landlord_display_name.trim(),
        caretaker_name: form.caretaker_name.trim() || null,
        caretaker_phone: form.caretaker_phone.trim() || null,
        caretaker_hours: form.caretaker_hours.trim() || null,
        deposit_amount: optionalNumber(form.deposit_amount),
        electricity_cost: optionalNumber(form.electricity_cost),
        wifi_cost: optionalNumber(form.wifi_cost),
        other_charges: form.other_charges.trim() || null,
        security_lighting: form.security_lighting,
        cctv_available: form.cctv_available,
        electricity_type: form.electricity_available
          ? form.electricity_type
          : null,
        water_type: form.water_available ? form.water_type : null,
        water_cost:
          form.water_available &&
          form.water_type === 'Tokens / Metered' &&
          form.water_cost !== ''
            ? optionalNumber(form.water_cost)
            : null,
        security_system: form.security_available
          ? form.security_system
          : null,
        wifi_available: form.wifi_available,
        description: form.description.trim(),
        images: [...form.images, ...uploadedImages],
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('properties')
        .update(payload)
        .eq('id', property.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) throw error;

      onSaved(data);
    } catch (error) {
      console.error('Unable to update property:', error);
      setErrorMessage(error.message || 'Unable to update this property.');
    } finally {
      setSaving(false);
    }
  }

  const selectedLocation = {
    lat: form.latitude,
    lng: form.longitude,
    accuracy: form.location_accuracy_meters,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#121215] p-6 text-gray-200 shadow-2xl">
        <div className="sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-white/10 bg-[#121215] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#E8DCC4]">
              Edit Property Listing
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Correct the listing details, photos or hostel location.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close property editor"
            className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-7">
          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <section className="space-y-4">
            <div>
              <h3 className="font-bold text-white">Basic information</h3>
              <p className="mt-1 text-sm text-gray-400">
                Keep the rent, vacancy and walking information accurate.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Property / hostel title *
                <input
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium">
                House type *
                <select
                  value={form.house_type}
                  onChange={(event) =>
                    update('house_type', event.target.value)
                  }
                  className={`${inputClass} mt-2`}
                >
                  {!['Bedsitter', 'Single room', '1 Bedroom', '2 Bedroom'].includes(
                    form.house_type
                  ) && (
                    <option value={form.house_type}>
                      {form.house_type} (existing value)
                    </option>
                  )}
                  <option value="Bedsitter">Bedsitter</option>
                  <option value="Single room">Single room</option>
                  <option value="1 Bedroom">1 Bedroom</option>
                  <option value="2 Bedroom">2 Bedroom</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="text-sm font-medium">
                Landmark *
                <input
                  required
                  value={form.landmark}
                  onChange={(event) => update('landmark', event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium">
                Walk (minutes) *
                <input
                  required
                  min="0"
                  type="number"
                  value={form.walk_mins}
                  onChange={(event) => update('walk_mins', event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium">
                Vacant rooms *
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.vacant_rooms}
                  onChange={(event) =>
                    update('vacant_rooms', event.target.value)
                  }
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium">
                Semester rent (KSh) *
                <input
                  required
                  min="0"
                  type="number"
                  value={form.semester_rent}
                  onChange={(event) =>
                    update('semester_rent', event.target.value)
                  }
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className="border-t border-white/10 pt-6">
            <LocationPicker
              value={selectedLocation}
              onLocationSelect={updateLocation}
            />
            {form.latitude !== null && form.longitude !== null && (
              <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                Selected hostel location: {Number(form.latitude).toFixed(6)},{' '}
                {Number(form.longitude).toFixed(6)}
              </p>
            )}
          </section>

          <section className="space-y-4 border-t border-white/10 pt-6">
            <div>
              <h3 className="font-bold text-white">Property management</h3>
              <p className="mt-1 text-sm text-gray-400">
                The primary contact remains the verified landlord number.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Landlord display name *
                <input
                  required
                  value={form.landlord_display_name}
                  onChange={(event) =>
                    update('landlord_display_name', event.target.value)
                  }
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium">
                Verified contact number
                <input
                  readOnly
                  value={verifiedPhone || form.whatsapp}
                  className={`${inputClass} mt-2 cursor-not-allowed opacity-70`}
                />
              </label>
              <label className="text-sm font-medium">
                Caretaker name
                <input
                  value={form.caretaker_name}
                  onChange={(event) =>
                    update('caretaker_name', event.target.value)
                  }
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium">
                Caretaker phone
                <input
                  type="tel"
                  value={form.caretaker_phone}
                  onChange={(event) =>
                    update('caretaker_phone', event.target.value)
                  }
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Caretaker availability
                <input
                  value={form.caretaker_hours}
                  onChange={(event) =>
                    update('caretaker_hours', event.target.value)
                  }
                  placeholder="For example, Monday–Saturday, 7am–8pm"
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-white/10 pt-6">
            <div>
              <h3 className="font-bold text-white">
                Semester cost breakdown
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Correct every charge students should expect to pay.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['deposit_amount', 'Deposit (KSh)'],
                ['electricity_cost', 'Electricity per semester (KSh)'],
                ['wifi_cost', 'Wi-Fi per semester (KSh)'],
              ].map(([field, label]) => (
                <label key={field} className="text-sm font-medium">
                  {label}
                  <input
                    min="0"
                    type="number"
                    value={form[field]}
                    onChange={(event) => update(field, event.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium">
              Other charges and payment terms
              <textarea
                rows={3}
                value={form.other_charges}
                onChange={(event) =>
                  update('other_charges', event.target.value)
                }
                className={`${inputClass} mt-2`}
              />
            </label>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.security_lighting}
                  onChange={(event) =>
                    update('security_lighting', event.target.checked)
                  }
                />
                Security lighting
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.cctv_available}
                  onChange={(event) =>
                    update('cctv_available', event.target.checked)
                  }
                />
                CCTV available
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="font-bold text-white">
              Property amenities and specifications
            </h3>
            <div className="space-y-4 rounded-xl border border-white/5 bg-[#18181B]/50 p-5">
              <div className="grid items-center gap-3 border-b border-white/10 pb-4 md:grid-cols-[1fr_1fr]">
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    checked={form.electricity_available}
                    onChange={(event) =>
                      update('electricity_available', event.target.checked)
                    }
                  />
                  Electricity
                </label>
                {form.electricity_available && (
                  <select
                    value={form.electricity_type}
                    onChange={(event) =>
                      update('electricity_type', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="Prepaid Tokens">Prepaid Tokens</option>
                    <option value="Postpaid / Metered">
                      Postpaid / Metered
                    </option>
                    <option value="Included in Rent">Included in Rent</option>
                  </select>
                )}
              </div>

              <div className="grid items-center gap-3 border-b border-white/10 pb-4 md:grid-cols-[1fr_1fr]">
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    checked={form.water_available}
                    onChange={(event) =>
                      update('water_available', event.target.checked)
                    }
                  />
                  Water supply
                </label>
                {form.water_available && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={form.water_type}
                      onChange={(event) =>
                        update('water_type', event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="Free Running Water">
                        Free Running Water
                      </option>
                      <option value="Tokens / Metered">
                        Tokens / Metered
                      </option>
                      <option value="Borehole">Borehole</option>
                    </select>
                    {form.water_type === 'Tokens / Metered' && (
                      <input
                        min="0"
                        type="number"
                        value={form.water_cost}
                        onChange={(event) =>
                          update('water_cost', event.target.value)
                        }
                        placeholder="Water cost"
                        className={inputClass}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="grid items-center gap-3 border-b border-white/10 pb-4 md:grid-cols-[1fr_1fr]">
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    checked={form.security_available}
                    onChange={(event) =>
                      update('security_available', event.target.checked)
                    }
                  />
                  Security
                </label>
                {form.security_available && (
                  <select
                    value={form.security_system}
                    onChange={(event) =>
                      update('security_system', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="Security Guard">Security Guard</option>
                    <option value="Gated Compound">Gated Compound</option>
                    <option value="CCTV Surveillance">
                      CCTV Surveillance
                    </option>
                    <option value="None">None</option>
                  </select>
                )}
              </div>

              <label className="flex items-center justify-between gap-3 font-medium">
                High-speed Wi-Fi available
                <input
                  type="checkbox"
                  checked={form.wifi_available}
                  onChange={(event) =>
                    update('wifi_available', event.target.checked)
                  }
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-white/10 pt-6">
            <div>
              <h3 className="font-bold text-white">Listing photos</h3>
              <p className="mt-1 text-sm text-gray-400">
                Remove incorrect photos or add replacements. Maximum 6.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.images.map((image, index) => (
                <div key={`${image}-${index}`} className="relative">
                  <Image
                    src={image}
                    alt={`Existing property photo ${index + 1}`}
                    width={400}
                    height={200}
                    unoptimized
                    className="h-32 w-full rounded-xl border border-white/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
                    aria-label={`Remove existing photo ${index + 1}`}
                    className="absolute right-2 top-2 rounded-lg bg-black/75 p-2 text-red-300 hover:bg-red-500/30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {newImages.map((image, index) => (
                <div key={image.preview} className="relative">
                  <Image
                    src={image.preview}
                    alt={`New property photo ${index + 1}`}
                    width={400}
                    height={200}
                    unoptimized
                    className="h-32 w-full rounded-xl border border-blue-500/30 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    aria-label={`Remove new photo ${index + 1}`}
                    className="absolute right-2 top-2 rounded-lg bg-black/75 p-2 text-red-300 hover:bg-red-500/30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {form.images.length + newImages.length < 6 && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-sm font-semibold hover:border-blue-500/50 hover:bg-blue-500/5">
                <ImagePlus size={18} className="text-blue-400" />
                Add replacement photos
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={addImages}
                  className="hidden"
                />
              </label>
            )}
          </section>

          <section className="border-t border-white/10 pt-6">
            <label className="block text-sm font-medium">
              Description and notes
              <textarea
                rows={5}
                maxLength={3000}
                value={form.description}
                onChange={(event) =>
                  update('description', event.target.value)
                }
                className={`${inputClass} mt-2 resize-y`}
              />
            </label>
          </section>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-white/10 bg-[#121215] py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl bg-white/5 px-5 py-2.5 text-gray-300 hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} />
              {saving ? 'Saving changes...' : 'Save all changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
