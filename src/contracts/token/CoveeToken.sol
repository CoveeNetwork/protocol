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
 * @title Covee Token
 * @version 0.7
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */
pragma solidity 0.4.24;

import 'openzeppelin-solidity/contracts/token/ERC20/CappedToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardBurnableToken.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import '../covee/CoveeSingleTxInterface.sol';

contract CoveeToken is CappedToken, StandardBurnableToken {

    string public name = "Covee Network";
    string public symbol = "XCV";
    uint256 public decimals = 18;

    /**
     * @dev creates a new CoveeToken
     * @param _cap maximum tokens
     */
    constructor (uint256 _cap) CappedToken(_cap) public {

    }

    /**
     * Proxy function to transfer tokens to the Covee smart contract in a single
     * transaction when calling startApplicationPeriod()
     * @param _projectId The project identifier.
     * @param _roleCount The number of roles in the project (1 <= _roleCount < 42).
     * @param _applicationDeadline Point in time until when users can apply for a role in the project.
     * @param _teamFormationDeadline Point in time until when the team initiator has to form the team.
     * @param _projectStartTime Point in time when the project is supposed to start.
     * @param _projectStakingAmounts The token amounts that must be put at stake in order to apply for the roles in the project.
     * @param _projectReward The optional reward, required to be zero if the project is not a client-defined one.
     * @param _covee The Covee contract we want to use.
     **/
    function startApplicationPeriod(
        bytes32 _projectId,
        uint256 _roleCount,
        uint256 _applicationDeadline,
        uint256 _teamFormationDeadline,
        uint256 _projectStartTime,
        uint256[] _projectStakingAmounts,
        uint256 _projectReward,
        CoveeSingleTxInterface _covee
    ) public {
        _covee.startApplicationPeriod(
            _projectId,
            _roleCount,
            _applicationDeadline,
            _teamFormationDeadline,
            _projectStartTime,
            _projectStakingAmounts,
            _projectReward,
            msg.sender
            );
        uint256 amount = _projectReward + _projectStakingAmounts[0];
        transfer(_covee, amount);
        emit ApplicationStarted(_projectId, msg.sender);
    }
    event ApplicationStarted(bytes32 indexed projectId, address indexed initiator);
    /**
     * Proxy function to transfer tokens to the Covee smart contract in a single
     * transaction when calling apply()
     * @param _projectId The project identifier.
     * @param _roleIndex The role identifier.
     * @param _amount The token amount to stake.
     * @param _covee The Covee contract we want to use.
     */
    function apply(bytes32 _projectId, uint256 _roleIndex, uint256 _amount, CoveeSingleTxInterface _covee)
    public
    {
        _covee.apply(_projectId, _roleIndex, _amount, msg.sender);
        transfer(_covee, _amount);
        emit AppliedForRole(_projectId, _roleIndex, msg.sender);
    }
    event AppliedForRole(bytes32 indexed projectId, uint256 _roleIndex, address indexed applicant);

}