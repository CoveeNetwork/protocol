/*
    This file is part of the Covee Network protocol (smart contracts).

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @title Covee Contract
 * @version 0.7
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 * @dev The Covee contract contains functionality which requires consensus, and therefore is justified to put into a smart contract.
 **/
pragma solidity 0.4.24;

import '../token/CoveeToken.sol';
import './CoveeSingleTxInterface.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract Covee is CoveeSingleTxInterface {
    using SafeMath for uint256;

    /**
     * The project initiator gets the first index.
     **/
    uint256 constant INITIATOR_ROLE = 0;

    /**
     * A de facto constant assigned in the constructor.
     **/
    uint256 ONE_COVEE_TOKEN;

    /**
     * The following fields characterize a project.
     **/
    struct Project {
        uint256 applicationDeadline;
        uint256 teamFormationDeadline;
        uint256 projectStartTime;
        address initiator;
    }

    /**
     * The following states (see finite state machine) represent
     * all different phases of a project.
     **/
    enum Stages {
        ProjectApplicationTime,
        ProjectMemberSelection,
        ProjectDefinition,
        ProjectInProgress,
        ProjectInvalid,
        ProjectEnded
    }

    /**
     * The Covee token.
     **/
    CoveeToken public coveeToken;

    /**
     * The address of the provider of review details, etc; i.e. the address of Covee Network.
     **/
    address public contractTrustee;

    /**
     * The beneficiary of the transaction fee or dividend or commission; i.e. the address of Covee Network.
     **/
    address public contractFeeBeneficiary;

    /**
     * The global Covee transaction fee or dividend or commission.
     * Note that we use the same precision as for the Covee token for this value, i.e., 18 decimal places.
     **/
    uint256 public contractTxFeeDefault;

    /**
     * Map a project identifier to a project.
     **/
    mapping(bytes32 => Project) public project;

    /**
     * Map a project identifier to a project stage.
     * @dev note that the state might be not be the actual one. Use getCurrentStage() for transiting and fetching the actual state reliably
     **/
    mapping(bytes32 => Stages) public stage;

    /**
     * Map a project id, a role identifier and a user's address to a boolean value that indicates whether the user has applied for the role in the project.
     **/
    mapping(bytes32 => bool) public applicant;

    /**
     * Map a project identifier to all team members.
     * Indexed by role from 0...N-1.
     **/
    mapping(bytes32 => address[]) public projectMembers;

    /**
     * Map a project identifier to the array of staking amounts.
     * Indexed by role from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectStakingAmounts;

    /**
     * Map a project identifier to a logical value indicating whether the role has at least one applicant.
     * Indexed by role from 0...N-1.
     **/
    mapping(bytes32 => bool[]) public projectRoleHasApplication;

    /**
     * Map a project identifier to a number indicating how many roles have seen an application.
     **/
    mapping(bytes32 => uint256) public projectRoleNumberOfApplication;

    /**
     * Map a project identifier to the total amount of staked tokens, required to calculate fees.
     * Indexed by role from 0...N-1.
     **/
    mapping(bytes32 => uint256) public projectTotalStake;

    /**
     * Map a project identifier to a the milestone deadline(s).
     * Indexed by milestone from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectMilestoneDeadlines;

    /**
     * Map a project identifier to the initiator review deadline(s).
     * Indexed by milestone from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectInitiatorReviewDeadlines;

    /**
     * Map a project identifier to the peer-to-peer review deadline(s).
     * Indexed by milestone from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectPeerReviewDeadlines;

    /**
     * Map a project identifier to the project reward (client fee).
     **/
    mapping(bytes32 => uint256) public projectReward;

    /**
     * Map a project identifier to the remaining client fee (amount of remaining reward tokens).
     **/
    mapping(bytes32 => uint256) public projectRewardRemainder;

    /**
     * Map a project identifier to the array of expected milestone progress values, using the precision of the Covee token.
     * Indexed by milestone from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectMilestoneExpectedProgress;

    /**
     * Map a project identifier to the array of realized milestone progress values, using the precision of the Covee token.
     * Indexed by milestone from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectMilestoneRealizedProgress;

    /**
     * Map a project identifier to the milestone review fraction(s), using the precision of the Covee token.
     * Indexed by milestone from 0...N-1.
     **/
    mapping(bytes32 => uint256[]) public projectMilestoneSplitOfContributions;

    /**
     * Map a composed key (project id, role index) to the logical value indicating whether a team member's tokens have been released.
     **/
    mapping(bytes32 => bool) public projectMemberPaid;

    /**
     * Map a project identifier to the actual fee / dividend / commission attached to this project.
     **/
    mapping(bytes32 => uint256) public projectTxFee;

    /**
     * Map a project identifier to the logical value indicating whether the Covee transaction fee / dividend / commission for the project has been transferred at project end.
     */
    mapping(bytes32 => bool) public projectTxFeePaid;

    /**
     * Construct a Covee contract.
     * @param _coveeToken The token that is used for staking.
     * @param _contractTrustee The entity (e.g. Covee Network) that calculates token amounts to be released at each milestone.
     * @param _contractFeeBeneficiary The address to which fees/ dividends / commissions are transferred to.
     **/
    constructor(
        address _coveeToken,
        address _contractTrustee,
        address _contractFeeBeneficiary
    )
    public {
        require(address(0) != address(_coveeToken));
        coveeToken = CoveeToken(_coveeToken);
        ONE_COVEE_TOKEN = 10 ** coveeToken.decimals();
        contractTrustee = _contractTrustee;
        contractFeeBeneficiary = _contractFeeBeneficiary;
        contractTxFeeDefault = 1e16; // our default is a 1% fee
    }

    /**
     * Allow or reject a state transition.
     * @param _stage The stage to check against.
     * @param _projectId The project identifier.
     **/
    modifier atStage(Stages _stage, bytes32 _projectId) {
        require(stage[_projectId] == _stage);
        _;
    }

    /**
     * Perform timed transitions.
     * Please be sure to call this modifier first!
     * Otherwise, the new stage will not be taken into account!
     * @param _projectId The project identifier.
     **/
    modifier guardStages(bytes32 _projectId) {
        if (stage[_projectId] == Stages.ProjectApplicationTime &&
                    now >= project[_projectId].applicationDeadline) {
            if (projectRoleNumberOfApplication[_projectId] == projectMembers[_projectId].length) {
                stage[_projectId] = Stages.ProjectMemberSelection;
                emit StageTransited(_projectId, Stages.ProjectApplicationTime, Stages.ProjectMemberSelection);
            }
            else {
                stage[_projectId] = Stages.ProjectInvalid;
                emit StageTransited(_projectId, Stages.ProjectApplicationTime, Stages.ProjectInvalid);
            }
        } else if (stage[_projectId] == Stages.ProjectMemberSelection &&
                    now >= project[_projectId].teamFormationDeadline) {
                stage[_projectId] = Stages.ProjectInvalid;
                emit StageTransited(_projectId, Stages.ProjectMemberSelection, Stages.ProjectInvalid);
        } else if (stage[_projectId] == Stages.ProjectInProgress &&
                now >= projectPeerReviewDeadlines[_projectId][projectMilestoneDeadlines[_projectId].length-1]) {
                stage[_projectId] = Stages.ProjectEnded;
                emit StageTransited(_projectId, Stages.ProjectInProgress, Stages.ProjectEnded);
        }
        _;
    }
    event StageTransited(bytes32 indexed _projectId, Stages oldState, Stages newState);

    /**
     * Set the default Covee transaction fee or dividend or commission.
     * This percentage is be assigned to every new project at its inception by assigning `projectTxFee[_projectId] = contractTxFeeDefault` and cannot be changed afterwards.
     * @param _contractTxFeeDefault The new dividend is a rate and by definition smaller than 100%, where we define 100% as the value of one Covee token.
     * Thus, the precision of the Covee token is used, i.e., using 18 decimal places, a 2% dividend translates to `_contractTxFeeDefault = 2e16`.
     */
    function setContractTxFeeDefault(uint256 _contractTxFeeDefault)
        external
    {
        require(msg.sender == contractTrustee);
        require(ONE_COVEE_TOKEN > _contractTxFeeDefault);
        contractTxFeeDefault = _contractTxFeeDefault;
    }

    /**
     * Get and bring the contract to the current state.
     * Getting the stage without updating can be misleading, hence a transaction is required.
     **/
    function getCurrentStage(bytes32 _projectId)
        guardStages(_projectId)
        external returns (uint256 result)
    {
        return uint256(stage[_projectId]);
    }

    /**
     * Create and initialize a new project and starts the application period.
     * @param _projectId The project identifier.
     * @param _roleCount The number of roles in the project (1 <= _roleCount < 42).
     * @param _applicationDeadline Point in time until when users can apply for a role in the project.
     * @param _teamFormationDeadline Point in time until when the team initiator has to form the team.
     * @param _projectStartTime Point in time when the project is supposed to start.
     * @param _projectStakingAmounts The token amounts that must be put at stake in order to apply for the roles in the project.
     * @param _projectReward The optional reward, required to be zero if the project is not a client-defined one.
     * @param _sender The original sender of the transaction.
     **/
    function startApplicationPeriod(
        bytes32 _projectId,
        uint256 _roleCount,
        uint256 _applicationDeadline,
        uint256 _teamFormationDeadline,
        uint256 _projectStartTime,
        uint256[] _projectStakingAmounts,
        uint256 _projectReward,
        address _sender
    )
    atStage(Stages.ProjectApplicationTime, _projectId)
    public {
        require(msg.sender == address(coveeToken));
        require(project[_projectId].initiator == address(0)); // workaround to check whether the project already exists
        require(0 < _roleCount && _roleCount < 42); // we check for reasonable _roleCount sizes
        require(_projectStartTime > now);
        require(_roleCount == _projectStakingAmounts.length);

        require(_applicationDeadline < _teamFormationDeadline);
        require(_teamFormationDeadline < _projectStartTime);

        projectStakingAmounts[_projectId].length = _roleCount;
        projectMembers[_projectId].length = _roleCount;

        projectReward[_projectId] = _projectReward;
        projectRewardRemainder[_projectId] = _projectReward;

        project[_projectId].applicationDeadline = _applicationDeadline;
        project[_projectId].teamFormationDeadline = _teamFormationDeadline;
        project[_projectId].initiator = _sender;
        project[_projectId].projectStartTime = _projectStartTime;

        projectRoleHasApplication[_projectId] = new bool[](_roleCount); // set false by default
        projectTxFee[_projectId] = contractTxFeeDefault;

        uint256 sum = 0;
        for (uint256 i = 0; i < _projectStakingAmounts.length; i = i+1) {
            sum = sum.add(_projectStakingAmounts[i]);
            projectStakingAmounts[_projectId][i] = _projectStakingAmounts[i];
        }
        projectTotalStake[_projectId] = sum;

        // team initiator stakes tokens
        apply(_projectId, INITIATOR_ROLE, _projectStakingAmounts[INITIATOR_ROLE], _sender);
    }

    /***
     * Users apply for a role in a project.
     * @param _projectId The project identifier.
     * @param _roleIndex The role identifier.
     * @param _amount The token amount to stake.
     * @param _sender The original sender of the transaction.
     ***/
    function apply(bytes32 _projectId, uint256 _roleIndex, uint256 _amount, address _sender)
        guardStages(_projectId)
        atStage(Stages.ProjectApplicationTime, _projectId)
    public
    {
        require(msg.sender == address(coveeToken));

        // require that only the initiator can claim the initiator role
        if (INITIATOR_ROLE == _roleIndex)
             require(project[_projectId].initiator == _sender);

        require(projectStakingAmounts[_projectId][_roleIndex] == _amount);
        bytes32 projectRoleId = composeBytes32Uint256Key(_projectId, _roleIndex);
        bytes32 applicantForRoleId = composeBytes32AddressKey(projectRoleId, _sender);
        require(!applicant[applicantForRoleId]);
        if (!projectRoleHasApplication[_projectId][_roleIndex]) {
           projectRoleNumberOfApplication[_projectId] = projectRoleNumberOfApplication[_projectId].add(1);
           projectRoleHasApplication[_projectId][_roleIndex] = true;
        }
        applicant[applicantForRoleId] = true;
    }

    /**
     * Users claim their tokens back if not selected as a team member or in case the project got invalidated.
     * @param _projectId The project identifier.
     * @param _roleIndex The role identifier.
     **/
    function claimMoneyBack(bytes32 _projectId, uint256 _roleIndex)
        guardStages(_projectId)
        external
    {
        require(
            stage[_projectId] == Stages.ProjectInProgress ||
            stage[_projectId] == Stages.ProjectInvalid ||
            stage[_projectId] == Stages.ProjectDefinition ||
            stage[_projectId] == Stages.ProjectEnded
        );

        bytes32 applicantForRoleId = composeBytes32Uint256AddressKey(_projectId, _roleIndex, msg.sender);

        // if the project is not invalid, only rejected applicants can claim their token back
        if (stage[_projectId] != Stages.ProjectInvalid)
            require(!isTeamMember(_projectId, _roleIndex, msg.sender));

        require(applicant[applicantForRoleId]);
        applicant[applicantForRoleId] = false;
        uint256 reimbursement = projectStakingAmounts[_projectId][_roleIndex];
        coveeToken.increaseApproval(msg.sender, reimbursement);
        emit Reimbursed(_projectId, msg.sender, reimbursement);
    }
    event Reimbursed(bytes32 indexed projectId, address beneficiary, uint256 amount);

    /**
     * Select team members.
     * Only the initiator can select (accept and reject) team members after the end of the application phase!
     * @param _projectId The project identifier.
     * @param _winners The array of winning addresses.
     **/
    function confirmTeamMembers(bytes32 _projectId, address[] _winners)
        guardStages(_projectId)
        atStage(Stages.ProjectMemberSelection, _projectId)
        external
    {
        require(now >= project[_projectId].applicationDeadline);
        require(msg.sender == project[_projectId].initiator);
        require(_winners.length == projectMembers[_projectId].length);
        projectMembers[_projectId] = _winners;
        stage[_projectId] = Stages.ProjectDefinition;
        emit projectMembersConfirmed(_projectId);
    }
    event projectMembersConfirmed(bytes32 indexed projectId);

    /**
     * Cancel the project at team formation stage.
     * Only the initiator do this!
     * @param _projectId the project to cancelTeamFormation
     **/
    function cancelTeamFormation(bytes32 _projectId)
        guardStages(_projectId)
        atStage(Stages.ProjectMemberSelection, _projectId)
        external
    {
        require(msg.sender == project[_projectId].initiator);
        stage[_projectId] = Stages.ProjectInvalid;
    }

    /**
     * Define a new project.
     * Only the initiator can do this!
     * @param _projectId the project id
     * @param _projectMilestoneDeadlines all deadlines of all milestones
     * @param _projectInitiatorReviewDeadlines all review deadlines for the initiator
     * @param _projectPeerReviewDeadlines all peer-to-peer review deadlines for the team for all milestones
     * @param _projectMilestoneExpectedProgress The expected progress values for each milestone, must sum to 100%.
     **/
    function defineProject(
        bytes32 _projectId,
        uint256[] _projectMilestoneDeadlines,
        uint256[] _projectInitiatorReviewDeadlines,
        uint256[] _projectPeerReviewDeadlines,
        uint256[] _projectMilestoneExpectedProgress)
        guardStages(_projectId)
        atStage(Stages.ProjectDefinition, _projectId)
        external
    {
        require(msg.sender == project[_projectId].initiator);
        require(now >= project[_projectId].teamFormationDeadline);
        require(_projectMilestoneDeadlines.length == _projectInitiatorReviewDeadlines.length, "number of _projectInitiatorReviewDeadlines inconsistent");
        require(_projectMilestoneDeadlines.length == _projectPeerReviewDeadlines.length, "number of _projectPeerReviewDeadlines inconsistent");
        require(_projectMilestoneDeadlines.length == _projectMilestoneExpectedProgress.length,  "number of _projectMilestoneExpectedProgress inconsistent");
        require(sumEqualsOne(_projectMilestoneExpectedProgress), "the _projectMilestoneExpectedProgress must sum to 100%");
        projectMilestoneRealizedProgress[_projectId] = new uint256[](_projectMilestoneDeadlines.length);
        projectMilestoneDeadlines[_projectId] = _projectMilestoneDeadlines;
        projectInitiatorReviewDeadlines[_projectId] = _projectInitiatorReviewDeadlines;
        projectPeerReviewDeadlines[_projectId] = _projectPeerReviewDeadlines;
        projectMilestoneExpectedProgress[_projectId] = _projectMilestoneExpectedProgress;
        stage[_projectId] = Stages.ProjectInProgress;
        emit ProjectDefined(_projectId);
    }
    event ProjectDefined(bytes32 indexed _projectId);

    /**
     * Test whether an array of percentages to 100%.
     * NOTE: We are using the precision of the Covee token.
     * @param _array The array of percentages to be checked.
     * @return Returns `true` if and only if the sum equals 1, i.e., one Covee token.
     **/
    function sumEqualsOne(uint256[] _array)
        view
    private
        returns (bool)
    {
        require(_array.length < 1000, "only up to 1000 entries allowed in array"); // have a reasonable limit here
        uint256 sum;
        for (uint256 i = 0; i < _array.length; i = i + 1) {
            sum = sum.add(_array[i]); // overflow impossible due to restriction on number of entries
        }
        require(sum <= ONE_COVEE_TOKEN, "sum over array is larger than 1");
        return sum == ONE_COVEE_TOKEN;
    }

    /**
     * Submit the realized progress of a milestone.
     * Only the initiator can do this!
     * @param _projectId The project identifier.
     * @param _milestoneId The milestone identifier.
     * @param _realizeProgress The realized progress achieved at the milestone.
     **/
    function reviewAsInitiator(
        bytes32 _projectId,
        uint256 _milestoneId,
        uint256 _realizeProgress
    )
        atStage(Stages.ProjectInProgress, _projectId)
        external
    {
        require(msg.sender == project[_projectId].initiator);
        require(_milestoneId < projectMilestoneDeadlines[_projectId].length);
        require(now >= projectMilestoneDeadlines[_projectId][_milestoneId]);
        require(now < projectInitiatorReviewDeadlines[_projectId][_milestoneId]);
        projectMilestoneRealizedProgress[_projectId][_milestoneId] = _realizeProgress;

        // checks if sum of all milestone ratings <= 100%
        sumEqualsOne(projectMilestoneRealizedProgress[_projectId]);
        emit InitiatorReviewedMilestone(_projectId, _milestoneId);
    }
    event InitiatorReviewedMilestone(bytes32 indexed projectId, uint256 milestone);

    /**
     * Submit the split of contributions according to the peer-to-peer review.
     * Only the trustee can do this!
     * @param _projectId The project identifier.
     * @param _milestoneId The milestone identifier.
     * @param _split The array of fractions holding the split of contributions.
     */
    function submitSplitOfContributions(
        bytes32 _projectId,
        uint256 _milestoneId,
        uint256[] _split
    )
        external
    {
        require(msg.sender == contractTrustee);
        require(_milestoneId < projectMilestoneDeadlines[_projectId].length);
        require(now >= projectInitiatorReviewDeadlines[_projectId][_milestoneId]);
        require(now < projectPeerReviewDeadlines[_projectId][_milestoneId]);
        require(sumEqualsOne(_split));

        // in case the initiator did not submit a milestone rating, the expected rating (see project definition) is taken
        if (projectMilestoneRealizedProgress[_projectId][_milestoneId] == 0)
            projectMilestoneRealizedProgress[_projectId][_milestoneId] =
             projectMilestoneExpectedProgress[_projectId][_milestoneId];

        allocateSplitOfContributions(_projectId, _milestoneId, _split);
        bytes32 projectMilestoneId = composeBytes32Uint256Key(_projectId, _milestoneId);
        projectMilestoneSplitOfContributions[projectMilestoneId] = _split;
        emit ProjectMilestonePaymentProcessed(_projectId, _milestoneId);
    }
    event ProjectMilestonePaymentProcessed(bytes32 indexed projectId, uint256 milestone);

    /**
     * Calculate and allocate token amounts for each team member and the network fee.
     * @param _projectId The project identifier.
     * @param _milestoneId The milestone identifier.
     * @param _split The array of fractions holding the split of contributions.
     */
    function allocateSplitOfContributions(
        bytes32 _projectId,
        uint256 _milestoneId,
        uint[] _split
    )
        internal
    {
        uint256 feePercentage = projectTxFee[_projectId];
        uint256 reward = projectReward[_projectId];
        uint256 contribution = calculateMilestoneProgress(_projectId, _milestoneId);
        uint256 txFee = (feePercentage.mul(reward).mul(contribution)).div(ONE_COVEE_TOKEN ** 2);

        projectRewardRemainder[_projectId] = projectRewardRemainder[_projectId] - txFee;
        coveeToken.increaseApproval(contractFeeBeneficiary, txFee);

        uint256 constDividend = (ONE_COVEE_TOKEN.sub(feePercentage).mul(reward).mul(contribution)).div(ONE_COVEE_TOKEN ** 2);
        uint256 payoutClientFee;
        for (uint256 i = 0; i < _split.length; i = i + 1) {
            payoutClientFee = (constDividend.mul(_split[i])).div(ONE_COVEE_TOKEN);
            projectRewardRemainder[_projectId] = projectRewardRemainder[_projectId] - payoutClientFee;
            coveeToken.increaseApproval(projectMembers[_projectId][i], payoutClientFee);
        }
        emit ProjectMilestonePaymentsApproved(_projectId, _milestoneId);
    }
    event ProjectMilestonePaymentsApproved(bytes32 indexed _projectId, uint256 indexed _milestoneId);

    /**
     * Calculate the milestone progress.
     * @param _projectId The project identifier.
     * @param _milestoneId The milestone identifier.
     **/
    function calculateMilestoneProgress(
        bytes32 _projectId,
        uint256 _milestoneId)
    private
        view
        returns (uint256)
    {
        return _milestoneId > 0 ?
            // note that `_milestoneId - 1` cannot underflow
            (projectMilestoneRealizedProgress[_projectId][_milestoneId]).
                sub(projectMilestoneRealizedProgress[_projectId][_milestoneId-1])
            :
                projectMilestoneRealizedProgress[_projectId][_milestoneId];
    }

    /**
     * Release the transaction fee or dividend or commission to the beneficiary.
     * @param _projectId The project identifier.
     */
    function payoutCoveeFee(bytes32 _projectId)
        guardStages(_projectId)
        atStage(Stages.ProjectEnded, _projectId)
        external
    {
        require(!projectTxFeePaid[_projectId]);
        projectTxFeePaid[_projectId] = true;

        uint256 txFee = (projectTxFee[_projectId].mul(projectTotalStake[_projectId])).div(ONE_COVEE_TOKEN);
        coveeToken.increaseApproval(contractFeeBeneficiary, txFee);
        emit CoveeFeePaidOut(_projectId);
    }
    event CoveeFeePaidOut(bytes32 indexed _projectId);

    /**
     * Release staked token amounts after the project has ended.
     * @param _projectId The project identifier.
     * @param _roleIndex The role identifier.
     **/
    function payoutStakedTokens(bytes32 _projectId, uint256 _roleIndex)
        guardStages(_projectId)
        atStage(Stages.ProjectEnded, _projectId)
        external
    {
        require(isTeamMember(_projectId, _roleIndex, msg.sender));
        bytes32 applicantForRoleId = composeBytes32Uint256AddressKey(_projectId, _roleIndex, msg.sender);
        require(!projectMemberPaid[applicantForRoleId]);

        // to save stack space, we omit Safemath as we are not in danger of an overflow here
        uint256 withoutTransactionFeeDivided =
            (
                (ONE_COVEE_TOKEN - projectTxFee[_projectId])
                    * projectTotalStake[_projectId]
            ) / ONE_COVEE_TOKEN;

        bytes32 projectMilestoneId;
        uint256 sum = 0;
        for (uint256 x = 0; x < projectMilestoneDeadlines[_projectId].length; x=x.add(1)) {
            projectMilestoneId = composeBytes32Uint256Key(_projectId, x);
            require(projectMilestoneSplitOfContributions[projectMilestoneId].length > 0);
            sum = sum.add(
                    (calculateMilestoneProgress(_projectId, x).mul(projectMilestoneSplitOfContributions[projectMilestoneId][_roleIndex])).
                    div(projectMilestoneRealizedProgress[_projectId][projectMilestoneDeadlines[_projectId].length-1])
                );
        }
        projectMemberPaid[applicantForRoleId] = true;

        coveeToken.increaseApproval(msg.sender, withoutTransactionFeeDivided.mul(sum).div(ONE_COVEE_TOKEN));
        emit StakePaidOut(_projectId, _roleIndex);
    }
    event StakePaidOut(bytes32 indexed _projectId, uint256 indexed _roleId);

    /**
     * Reimburse the remaining reward tokens to the initiator.
     * Only the initiator can do this!
     * @param _projectId The project identifier.
     **/
    function reimburseInitiator(bytes32 _projectId)
        guardStages(_projectId)
        external
    {
        require(msg.sender == project[_projectId].initiator);
        require(
            stage[_projectId] == Stages.ProjectEnded ||
            stage[_projectId] == Stages.ProjectInvalid
        );
        uint256 remainder = projectRewardRemainder[_projectId];
        projectRewardRemainder[_projectId] = 0;
        coveeToken.increaseApproval(msg.sender, remainder);
        emit InitiatorReimbursed(_projectId);
    }
    event InitiatorReimbursed(bytes32 indexed _projectId);

     /**
     * Helper function that calculates composed keys from an identifier and an index.
     * @param _primaryKey The primary key (an identifier).
     * @param _secondaryKey The secondary key (an index).
     * @return Returns the composed key.
     */
    function composeBytes32Uint256Key(bytes32 _primaryKey, uint256 _secondaryKey)
        pure
    public
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_primaryKey, _secondaryKey));
    }

    /**
     * Helper function that composes keys.
     * @param _projectId The project identifier.
     * @param _roleId The role identifier. Note that this is a UINT256 value which matters for Keccak.
     * @param _applicant The address of the team member.
     */
    function composeBytes32Uint256AddressKey(
        bytes32 _projectId,
        uint256 _roleId,
        address _applicant
    )
        pure
    public
        returns (bytes32)
    {
        bytes32 projectRoleId = composeBytes32Uint256Key(_projectId, _roleId);
        bytes32 applicantForRoleId = keccak256(abi.encodePacked(projectRoleId, _applicant));
        return applicantForRoleId;
    }

    /**
     * Helper function that calculates composed keys from an identifier and an address.
     * @param _primaryKey The primary key (an identifier).
     * @param _secondaryKey The secondary key (an address).
     * @return Returns the composed key.
     */
    function composeBytes32AddressKey(bytes32 _primaryKey, address _secondaryKey)
        pure
    public
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_primaryKey, _secondaryKey));
    }

    /**
     * Helper function to determine if an address has a certain role.
     * @param _projectId The project identifier.
     * @param _roleId The role identifier.
     * @param _applicant The address to be checked.
     */
    function isTeamMember(
        bytes32 _projectId,
        uint256 _roleId,
        address _applicant
    )
        view
    private
        returns (bool)
    {
        return projectMembers[_projectId][_roleId] == _applicant;
    }

}
