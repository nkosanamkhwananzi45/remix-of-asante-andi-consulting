import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { z } from 'zod';

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(100),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  bio: z.string().trim().max(2000).optional().or(z.literal('')),
});

const ProviderProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, bio, skills')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        toast.error('Failed to load profile');
      } else if (data) {
        setFullName(data.full_name ?? '');
        setPhone(data.phone ?? '');
        setBio((data as any).bio ?? '');
        setSkills(((data as any).skills ?? []) as string[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || skills.includes(s) || skills.length >= 20) return;
    setSkills([...skills, s]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const handleSave = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ full_name: fullName, phone, bio });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        skills,
      } as any)
      .eq('id', user.id);
    setSaving(false);
    if (error) toast.error('Failed to save profile');
    else toast.success('Profile updated');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background pt-28 px-4 pb-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Tutor Profile</CardTitle>
              <CardDescription>
                Tell admins and clients about yourself. This helps with assignment matching.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={30}
                      placeholder="+27..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={2000}
                      rows={5}
                      placeholder="Briefly describe your experience, qualifications, and approach."
                    />
                    <p className="text-xs text-muted-foreground text-right">{bio.length}/2000</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Skills</Label>
                    <div className="flex gap-2">
                      <Input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSkill();
                          }
                        }}
                        placeholder="e.g. Statistics, Academic Writing"
                        maxLength={50}
                      />
                      <Button type="button" variant="secondary" onClick={addSkill}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {skills.map((s) => (
                        <Badge key={s} variant="secondary" className="gap-1">
                          {s}
                          <button
                            type="button"
                            onClick={() => removeSkill(s)}
                            className="ml-1 hover:text-destructive"
                            aria-label={`Remove ${s}`}
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                      {skills.length === 0 && (
                        <p className="text-xs text-muted-foreground">No skills added yet.</p>
                      )}
                    </div>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save profile
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ProviderProfile;
