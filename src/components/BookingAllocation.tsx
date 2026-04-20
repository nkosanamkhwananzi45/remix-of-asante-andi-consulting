import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

interface Booking {
  id: string;
  full_name: string;
  service_category: string;
  package_selected: string;
  status: string;
  payment_status: string;
  amount: number | null;
  created_at: string;
  provider_id: string | null;
}

interface Provider {
  id: string;
  full_name: string | null;
  email: string | null;
  bio?: string | null;
  skills?: string[] | null;
}

const UNASSIGNED = '__unassigned__';

export const BookingAllocation = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [filterStatus]);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select('id, full_name, service_category, package_selected, status, payment_status, amount, created_at, provider_id');

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const { data: roleRows, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'provider');
      if (rolesErr) throw rolesErr;

      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        setProviders([]);
        return;
      }

      const { data: profileRows, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, bio, skills')
        .in('id', ids);
      if (profErr) throw profErr;

      setProviders((profileRows ?? []) as Provider[]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load providers');
    }
  };

  const providerMap = useMemo(() => {
    const m = new Map<string, Provider>();
    providers.forEach((p) => m.set(p.id, p));
    return m;
  }, [providers]);

  const handleAssign = async (bookingId: string, value: string) => {
    const newProviderId = value === UNASSIGNED ? null : value;
    setUpdatingId(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ provider_id: newProviderId })
        .eq('id', bookingId);
      if (error) throw error;

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, provider_id: newProviderId } : b))
      );
      toast.success(newProviderId ? 'Provider assigned' : 'Provider unassigned');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update assignment');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const unassignedCount = bookings.filter((b) => !b.provider_id).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Booking Allocation</CardTitle>
            <CardDescription>Assign a tutor/provider to each booking</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users size={16} className="text-muted-foreground" />
            <span className="font-semibold">{bookings.length} total</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bookings</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {providers.length} provider{providers.length === 1 ? '' : 's'} available · {unassignedCount} unassigned
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading bookings...</TableCell>
                </TableRow>
              ) : bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bookings found</TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => {
                  const assigned = booking.provider_id ? providerMap.get(booking.provider_id) : null;
                  return (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.full_name}</TableCell>
                      <TableCell className="capitalize">{booking.service_category.replace(/-/g, ' ')}</TableCell>
                      <TableCell>{booking.package_selected}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={booking.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {booking.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">R{(booking.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Select
                          value={booking.provider_id ?? UNASSIGNED}
                          onValueChange={(v) => handleAssign(booking.id, v)}
                          disabled={updatingId === booking.id}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue>
                              {assigned
                                ? (assigned.full_name || assigned.email || 'Unknown')
                                : <span className="text-muted-foreground">Unassigned</span>}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-w-sm">
                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                            {providers.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex flex-col gap-1 py-1">
                                  <span className="font-medium">
                                    {p.full_name || p.email || p.id.slice(0, 8)}
                                  </span>
                                  {p.skills && p.skills.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {p.skills.slice(0, 4).map((s) => (
                                        <span
                                          key={s}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {p.bio && (
                                    <span className="text-xs text-muted-foreground line-clamp-2">
                                      {p.bio}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(booking.created_at).toLocaleDateString('en-ZA')}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <Card className="bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingBookings.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-blue-600">{confirmedBookings.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{bookings.filter((b) => b.status === 'completed').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};
