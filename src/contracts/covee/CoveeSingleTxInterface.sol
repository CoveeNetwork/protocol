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

pragma solidity 0.4.24;

contract CoveeSingleTxInterface {
        function startApplicationPeriod(
        bytes32 _projectId,
        uint256 _roleCount,
        uint256 _applicationDeadline,
        uint256 _teamFormationDeadline,
        uint256 _projectStartTime,
        uint256[] _projectStakingAmounts,
        uint256 _projectReward,
        address _sender
    ) public;

    function apply(
        bytes32 _projectId,
        uint256 _roleIndex,
        uint256 _amount,
        address _sender
    ) public;
}
