import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useGradeLevels() {
  const [gradeLevels, setGradeLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGradeLevels = useCallback(async () => {
    const { data, error } = await supabase
      .from('grades')
      .select('grade_level')
      .order('grade_level');

    if (!error) {
      const sorted = (data || [])
        .map(g => g.grade_level)
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      setGradeLevels(sorted);
    } else {
      console.error('Failed to fetch grade levels:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGradeLevels();

    const channel = supabase
      .channel('grade-levels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grades' }, fetchGradeLevels)
      .subscribe();

    return () => channel.unsubscribe();
  }, [fetchGradeLevels]);

  return { gradeLevels, loading };
}