import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProfileData = {
  age: number;
  location: string;
  fitnessLevel: string;
  currentActivities: string[];
  interests: string[];
  goals: string[];
  targetMetrics: string[];
  availableTime: string;
};

export function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const [formData, setFormData] = useState<ProfileData>({
    age: 30,
    location: "",
    fitnessLevel: "Beginner",
    currentActivities: [],
    interests: [],
    goals: [],
    targetMetrics: [],
    availableTime: "3-4 hours per week",
  });

  const [currentActivity, setCurrentActivity] = useState("");
  const [interest, setInterest] = useState("");
  const [goal, setGoal] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const addActivity = () => {
    if (currentActivity.trim()) {
      setFormData({
        ...formData,
        currentActivities: [...formData.currentActivities, currentActivity.trim()],
      });
      setCurrentActivity("");
    }
  };

  const removeActivity = (index: number) => {
    setFormData({
      ...formData,
      currentActivities: formData.currentActivities.filter((_, i) => i !== index),
    });
  };

  const addInterest = () => {
    if (interest.trim()) {
      setFormData({
        ...formData,
        interests: [...formData.interests, interest.trim()],
      });
      setInterest("");
    }
  };

  const removeInterest = (index: number) => {
    setFormData({
      ...formData,
      interests: formData.interests.filter((_, i) => i !== index),
    });
  };

  const addGoal = () => {
    if (goal.trim()) {
      setFormData({
        ...formData,
        goals: [...formData.goals, goal.trim()],
      });
      setGoal("");
    }
  };

  const removeGoal = (index: number) => {
    setFormData({
      ...formData,
      goals: formData.goals.filter((_, i) => i !== index),
    });
  };

  const addTargetMetric = () => {
    if (targetMetric.trim()) {
      setFormData({
        ...formData,
        targetMetrics: [...formData.targetMetrics, targetMetric.trim()],
      });
      setTargetMetric("");
    }
  };

  const removeTargetMetric = (index: number) => {
    setFormData({
      ...formData,
      targetMetrics: formData.targetMetrics.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.location.trim()) {
      setError("Location is required");
      return;
    }
    if (formData.currentActivities.length === 0) {
      setError("Please add at least one current activity");
      return;
    }
    if (formData.interests.length === 0) {
      setError("Please add at least one interest");
      return;
    }
    if (formData.goals.length === 0) {
      setError("Please add at least one goal");
      return;
    }
    if (formData.targetMetrics.length === 0) {
      setError("Please add at least one target metric");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save profile");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Help us personalize your fitness experience by telling us about yourself
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  min="1"
                  max="120"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 30 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fitnessLevel">Fitness Level *</Label>
                <Select
                  value={formData.fitnessLevel}
                  onValueChange={(value) => setFormData({ ...formData, fitnessLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., San Francisco, CA"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="availableTime">Available Time Per Week *</Label>
              <Select
                value={formData.availableTime}
                onValueChange={(value) => setFormData({ ...formData, availableTime: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-2 hours per week">1-2 hours per week</SelectItem>
                  <SelectItem value="3-4 hours per week">3-4 hours per week</SelectItem>
                  <SelectItem value="5-7 hours per week">5-7 hours per week</SelectItem>
                  <SelectItem value="8+ hours per week">8+ hours per week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Current Activities *</Label>
              <div className="flex gap-2">
                <Input
                  value={currentActivity}
                  onChange={(e) => setCurrentActivity(e.target.value)}
                  placeholder="e.g., Running, Yoga"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addActivity();
                    }
                  }}
                />
                <Button type="button" onClick={addActivity} variant="outline">
                  Add
                </Button>
              </div>
              {formData.currentActivities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.currentActivities.map((activity, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {activity}
                      <button
                        type="button"
                        onClick={() => removeActivity(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {formData.currentActivities.length === 0 && (
                <p className="text-sm text-muted-foreground">Add at least one activity</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Interests *</Label>
              <div className="flex gap-2">
                <Input
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  placeholder="e.g., Marathon training, Strength building"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInterest();
                    }
                  }}
                />
                <Button type="button" onClick={addInterest} variant="outline">
                  Add
                </Button>
              </div>
              {formData.interests.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.interests.map((item, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeInterest(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {formData.interests.length === 0 && (
                <p className="text-sm text-muted-foreground">Add at least one interest</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Goals *</Label>
              <div className="flex gap-2">
                <Input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Complete a half marathon, Build strength"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGoal();
                    }
                  }}
                />
                <Button type="button" onClick={addGoal} variant="outline">
                  Add
                </Button>
              </div>
              {formData.goals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.goals.map((item, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeGoal(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {formData.goals.length === 0 && (
                <p className="text-sm text-muted-foreground">Add at least one goal</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Target Metrics *</Label>
              <div className="flex gap-2">
                <Input
                  value={targetMetric}
                  onChange={(e) => setTargetMetric(e.target.value)}
                  placeholder="e.g., Run 13.1 miles, Bench press 185 lbs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTargetMetric();
                    }
                  }}
                />
                <Button type="button" onClick={addTargetMetric} variant="outline">
                  Add
                </Button>
              </div>
              {formData.targetMetrics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.targetMetrics.map((item, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeTargetMetric(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {formData.targetMetrics.length === 0 && (
                <p className="text-sm text-muted-foreground">Add at least one target metric</p>
              )}
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Complete Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

