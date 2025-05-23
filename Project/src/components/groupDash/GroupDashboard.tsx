import { useState } from "react";
import { GroupInsertDto, JobDto, GroupJobInsertDto } from "../../utils/types";
import { createGroup, deleteGroup, addJobToGroup, removeJobFromGroup } from "../../service/supabaseService";
import JobList from "../jobDash/JobList";
import '../../styles/groupdashboard.css';
import plusSign from '../../assets/Busybee-plus-02.png';
import JobDetailsModal from "../jobDash/JobDetailsModal";
import { useDashboard } from '../../context/useDashboardContext';

const GroupDashboard: React.FC = () => {
    // Use the context to get all necessary state
    const { 
        user, 
        groups, 
        groupsToJobsList, 
        jobs,
        setGroups,
        setGroupsToJobsList
    } = useDashboard();
    
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<number[]>([]);
    const [showingJobDetails, setShowingJobDetails] = useState<boolean>(false);
    const [selectedJob, setSelectedJob] = useState<JobDto | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>("");
    
    const handleNewGroupSubmission = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        if (!user) {
            setErrorMessage("User not found. Please log in again.");
            return;
        }
        
        const formData = new FormData(event.currentTarget);
        const newGroupName: string = formData.get('newGroupName') as string; 
        console.log('Creating group: ', newGroupName);
        const groupInsertDto: GroupInsertDto = {group_name: newGroupName, user_id: user.user_id}
        
        const newGroup = await createGroup(groupInsertDto);

        if (newGroup) {
            setGroups(prev => [...(prev ?? []), newGroup]);
            setCreatingGroup(false);
        } else {
            console.log("Error creating group");
            setErrorMessage("Error creating group. Please try again.");
        }
    }

    const handleGroupDeletion = async (groupId: number) => {
        console.log("deleting group");
        await deleteGroup(groupId);
        
        if (!groups) return;
        
        let evicteeIndex = -1;
        for (let i = 0; i < groups.length; i++){
            if (groups[i].group_id === groupId){
                evicteeIndex = i;
                break;
            }
        }
        const newGroupArr = groups.filter((_, i) => i !== evicteeIndex);
        setGroups(newGroupArr);
        
        // Also update groupsToJobsList
        setGroupsToJobsList(prev => 
            prev ? prev.filter(g => g.groupDto.group_id !== groupId) : null
        );
    }

    const handleAddJobToGroup = async (groupId: number, jobId: number) => {
        if (!jobId) return;
        
        console.log(`Adding job ${jobId} to group ${groupId}`);
        const groupJobDto: GroupJobInsertDto = {
            group_id: groupId,
            job_id: jobId
        };
        
        const success = await addJobToGroup(groupJobDto);
        if (success && jobs) {
            // Find the job that was added
            const addedJob = jobs.find(job => job.job_id === jobId);
            if (addedJob) {
                // Update the groupsToJobsList state
                setGroupsToJobsList(prev => {
                    if (!prev) return prev;
                    
                    return prev.map(groupToJobs => {
                        if (groupToJobs.groupDto.group_id === groupId) {
                            // Add the job to this group's job list
                            return {
                                ...groupToJobs,
                                jobs: [...groupToJobs.jobs, addedJob]
                            };
                        }
                        return groupToJobs;
                    });
                });
            }
        } else {
            console.log("Error adding job to group");
            setErrorMessage("Error adding job to group. Please try again.");
        }
    }

    const handleRemoveJobFromGroup = async (groupId: number, jobId: number) => {
        if (!jobId) return;
        
        console.log(`Removing job ${jobId} from group ${groupId}`);
        const success = await removeJobFromGroup(groupId, jobId);
        if (success) {
            // Update the groupsToJobsList state
            setGroupsToJobsList(prev => {
                if (!prev) return prev;
                
                return prev.map(groupToJobs => {
                    if (groupToJobs.groupDto.group_id === groupId) {
                        // Remove the job from this group's job list
                        return {
                            ...groupToJobs,
                            jobs: groupToJobs.jobs.filter(job => job.job_id !== jobId)
                        };
                    }
                    return groupToJobs;
                });
            });
        } else {
            console.log("Error removing job from group");
            setErrorMessage("Error removing job from group. Please try again.");
        }
    }
  
    const getJobsNotInGroup = (groupId: number): JobDto[] => {
        if (!jobs || !groupsToJobsList) return [];
        
        // Find the jobs that are in this group
        const groupWithJobs = groupsToJobsList.find(g => g.groupDto.group_id === groupId);
        const jobsInGroup = groupWithJobs ? groupWithJobs.jobs.map(job => job.job_id) : [];
        
        // Return jobs that are not in this group
        return jobs.filter(job => !jobsInGroup.includes(job.job_id));
    }

    // Toggle group expansion to show/hide the job list
    const toggleGroupExpansion = (groupId: number) => {
        setExpandedGroups(prev => 
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    }

    const handleJobClick = (job: JobDto) => {
        setSelectedJob(job);
        setShowingJobDetails(true);
    }

    const closeModal = () => {
        setShowingJobDetails(false);
    }

    if (!groups || !groupsToJobsList) {
        return <div>Loading group data...</div>;
    }

    return (
    <>
        
        {!creatingGroup && 
            <div>
                <div className="groups-header-containter">
                <h1 className="groups-header">Your Groups</h1>
                <button onClick={() => setCreatingGroup(true)} className="create-group-button">
                    <img src={plusSign} alt="yellow plus sign" className="plus-sign-size" />
                    <h4>Add a group...</h4>
                </button>
                </div>
                <ul className="group-list">
                    {groups.map(group => {
                        // Find the corresponding group in groupsToJobsList
                        const groupWithJobs = groupsToJobsList.find(g => g.groupDto.group_id === group.group_id);
                        const jobsInGroup = groupWithJobs ? groupWithJobs.jobs : [];
                        // Get jobs not in this group
                        const jobsNotInGroup = getJobsNotInGroup(group.group_id);
                        const isExpanded = expandedGroups.includes(group.group_id);
                        
                        return (
                            <li key={group.group_id} className="group-item">
                                <div className="group-title">
                                    <div className="flex-row expand-button" style={{ width: '100%' }}>
                                        <button 
                                            className="expand-button"
                                            onClick={() => toggleGroupExpansion(group.group_id)}
                                        >
                                            {isExpanded ? '▼' : '►'}
                                        </button>
                                        <h3 className="group-name">{group.group_name}</h3>
                                    </div>
                                    
                                    <div className="group-controls">
                                        <select 
                                            className="addJobToGroupDropDown" 
                                            id={`addJobToGroup-${group.group_id}`}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value) {
                                                    handleAddJobToGroup(group.group_id, parseInt(value));
                                                    e.target.value = "";
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="">Add Job to Group</option>
                                            {jobsNotInGroup.map(job => (
                                                <option key={job.job_id} value={job.job_id}>
                                                    {job.company_name} - {job.job_title}
                                                </option>
                                            ))}
                                        </select>
                                        
                                        <select 
                                            className="removeJobFromGroupDropDown" 
                                            id={`removeJobFromGroup-${group.group_id}`}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value) {
                                                    handleRemoveJobFromGroup(group.group_id, parseInt(value));
                                                    e.target.value = "";
                                                }
                                            }}
                                            value=""
                                            disabled={jobsInGroup.length === 0}
                                        >
                                            <option value="">Remove Job from Group</option>
                                            {jobsInGroup.map(job => (
                                                <option key={job.job_id} value={job.job_id}>
                                                    {job.company_name} - {job.job_title}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="delete-button-group-container">
                                        <button 
                                            className="deleteButton" 
                                            onClick={() => handleGroupDeletion(group.group_id)}
                                        >
                                            Delete Group
                                        </button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Show the JobList component when the group is expanded */}
                                {isExpanded && (
                                    <div className="group-job-list-2">
                                        {jobsInGroup.length > 0 ? (
                                            <JobList 
                                                jobs={jobsInGroup} 
                                                jobListTitle={group.group_name} 
                                                onItemClick={handleJobClick}
                                            />
                                        ) : (
                                            <div className="no-jobs-message">
                                                <p>This group doesn't have any jobs yet. Add a job using the dropdown above.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
                    {showingJobDetails && selectedJob && (
                        <>
                            <JobDetailsModal job={selectedJob} onClose={closeModal} setErrorMessage={setErrorMessage} />
                        </>
                    )}
                    
                    {errorMessage !== "" && (
                        <div className="error-message">{errorMessage}</div>
                    )}
            </div>
        }
        {jobs && jobs.length === 0 && (
            <>
                <h5>It looks like you don't have any jobs yet... start by Adding some jobs and then you can group them here.</h5>
            </>)
        }

        {creatingGroup &&
            <div>
                <div className="back-button-header-container">
                    <button className="backButton-group" onClick={() => setCreatingGroup(false)}>← Back</button>
                    <h1 className="create-group">Create Group</h1>
                </div>
                <form onSubmit={(event) => handleNewGroupSubmission(event)} className="group-form">
                    <label htmlFor="newGroupName">Group Name</label>
                    <input type="text" id="newGroupName" name="newGroupName" />
                    <button type="submit">Submit New Group</button>
                </form>
            </div>
        }
    </>
    );
}

export default GroupDashboard;